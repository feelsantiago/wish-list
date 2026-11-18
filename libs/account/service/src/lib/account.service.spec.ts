import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { AsyncResult, Option, err, ok } from '@wish-list/common-result';
import type { Result } from '@wish-list/common-result';
import { Identity, User } from '@wish-list/domain';
import type { Category } from '@wish-list/domain';
import {
  CategoryRepository,
  DatabaseFailure,
  QueryScope,
  UserRepository,
} from '@wish-list/database';
import {
  createTestDatabase,
  databaseTestingProviders,
  makeUser,
} from '@wish-list/database/testing';
import type { TestDatabase } from '@wish-list/database/testing';
import { AccountService } from './account.service.js';

function value<T>(result: Result<T, unknown>): T {
  return result.match({
    ok: (v) => v,
    err: (error) => {
      throw error;
    },
  });
}

function identity(overrides: Partial<Identity.CreateInput> = {}): Identity {
  return value(
    Identity.create({
      providerId: 'uid-1',
      provider: 'google',
      email: 'jane.doe@example.com',
      name: Option.some('Jane Doe'),
      ...overrides,
    }),
  );
}

describe('AccountService.resolve', () => {
  let testDb: TestDatabase;
  let db: LibSQLDatabase;
  let service: AccountService;
  let users: UserRepository;
  let categories: CategoryRepository;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    db = testDb.db;
    const moduleRef = await Test.createTestingModule({
      providers: [...databaseTestingProviders(db), AccountService],
    }).compile();
    service = moduleRef.get(AccountService);
    users = moduleRef.get(UserRepository);
    categories = moduleRef.get(CategoryRepository);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await testDb.close();
  });

  async function resolve(id: Identity): Promise<User> {
    return value(await service.resolve(id).toPromise());
  }

  async function failureName(id: Identity): Promise<string> {
    return service.resolve(id).match({
      ok: () => {
        throw new Error('expected a failure');
      },
      err: (failure) => failure.name,
    });
  }

  async function stored(providerId: string): Promise<Option<User>> {
    return value(await users.findByProviderId(providerId).toPromise());
  }

  async function categoriesOf(user: User): Promise<Category[]> {
    return value(await categories.all(QueryScope.user(user.id)).toPromise());
  }

  describe('first sign-in', () => {
    it('creates the User and its Unsorted Category', async () => {
      const user = await resolve(identity());

      expect(user.providerId).toBe('uid-1');
      expect(user.email).toBe('jane.doe@example.com');
      expect((await stored('uid-1')).isSome()).toBe(true);

      const owned = await categoriesOf(user);
      expect(owned).toHaveLength(1);
      expect(owned[0]?.kind).toBe('unsorted');
    });

    it('stores the reported name as broker-sourced', async () => {
      const user = await resolve(identity());
      expect(user.name).toBe('Jane Doe');
      expect(user.nameSource).toBe('broker');
    });

    it("falls back to the email's local part when no name was reported", async () => {
      const user = await resolve(identity({ name: Option.none() }));
      expect(user.name).toBe('jane.doe');
      expect(user.nameSource).toBe('broker');
    });

    it('leaves no User behind when the transaction rolls back', async () => {
      vi.spyOn(CategoryRepository.prototype, 'insert').mockReturnValue(
        AsyncResult.fromResult(
          err(DatabaseFailure.query(new Error('disk I/O error'))),
        ),
      );

      expect(await failureName(identity())).toBe('unexpected');
      expect((await stored('uid-1')).isNone()).toBe(true);
    });

    it('returns conflict when the email belongs to another User', async () => {
      const other = makeUser({ email: 'jane.doe@example.com' });
      await users.insert(other).toPromise();

      expect(await failureName(identity())).toBe('conflict');
      expect((await stored('uid-1')).isNone()).toBe(true);
    });

    it('recovers when a concurrent first sign-in created the User first', async () => {
      const winner = await resolve(identity());
      const find = vi.spyOn(UserRepository.prototype, 'findByProviderId');
      find.mockReturnValueOnce(AsyncResult.fromResult(ok(Option.none())));

      const loser = await resolve(identity());

      expect(loser.id).toBe(winner.id);
      expect(find).toHaveBeenCalledTimes(2);
      expect(await categoriesOf(winner)).toHaveLength(1);
    });
  });

  describe('returning sign-in', () => {
    it('performs no writes when nothing changed', async () => {
      const created = await resolve(identity());
      const insert = vi.spyOn(UserRepository.prototype, 'insert');
      const update = vi.spyOn(UserRepository.prototype, 'update');
      const insertCategory = vi.spyOn(CategoryRepository.prototype, 'insert');

      const again = await resolve(identity());

      expect(again).toEqual(created);
      expect(insert).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(insertCategory).not.toHaveBeenCalled();
    });

    it('re-syncs provider and email drift', async () => {
      const created = await resolve(identity());

      const synced = await resolve(
        identity({ provider: 'github', email: 'jane@new.example' }),
      );

      expect(synced.id).toBe(created.id);
      const row = value((await stored('uid-1')).okOr('missing'));
      expect(row.provider).toBe('github');
      expect(row.email).toBe('jane@new.example');
      expect(await categoriesOf(created)).toHaveLength(1);
    });

    it('re-syncs a changed broker name', async () => {
      await resolve(identity());
      await resolve(identity({ name: Option.some('Jane D') }));
      expect(value((await stored('uid-1')).okOr('missing')).name).toBe(
        'Jane D',
      );
    });

    it('keeps the stored name when the broker reports none', async () => {
      await resolve(identity());
      await resolve(identity({ name: Option.none() }));
      expect(value((await stored('uid-1')).okOr('missing')).name).toBe(
        'Jane Doe',
      );
    });

    it('never overwrites a user-edited name', async () => {
      const created = await resolve(identity());
      await users.update(value(User.rename(created, 'JD'))).toPromise();

      const synced = await resolve(
        identity({ name: Option.some('Jane D'), provider: 'github' }),
      );

      expect(synced.name).toBe('JD');
      expect(synced.nameSource).toBe('user');
      expect(synced.provider).toBe('github');
    });

    it('returns conflict, and overwrites nothing, when the new email belongs to another User', async () => {
      await users.insert(makeUser({ email: 'taken@example.com' })).toPromise();
      await resolve(identity());

      expect(await failureName(identity({ email: 'taken@example.com' }))).toBe(
        'conflict',
      );
      expect(value((await stored('uid-1')).okOr('missing')).email).toBe(
        'jane.doe@example.com',
      );
    });
  });
});

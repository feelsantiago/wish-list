import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { AsyncResult, err } from '@wish-list/common-result';
import type { Result } from '@wish-list/common-result';
import type { ActiveUser, User, Wishlist } from '@wish-list/domain';
import {
  DatabaseFailure,
  QueryScope,
  UserRepository,
  WishlistRepository,
} from '@wish-list/database';
import {
  createTestDatabase,
  databaseTestingProviders,
  makeUser,
} from '@wish-list/database/testing';
import type { TestDatabase } from '@wish-list/database/testing';
import { WishlistService } from './wishlist.service.js';

function value<T>(result: Result<T, unknown>): T {
  return result.match({
    ok: (v) => v,
    err: (error) => {
      throw error;
    },
  });
}

describe('WishlistService', () => {
  let testDb: TestDatabase;
  let service: WishlistService;
  let users: UserRepository;
  let wishlists: WishlistRepository;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    const moduleRef = await Test.createTestingModule({
      providers: [...databaseTestingProviders(testDb.db), WishlistService],
    }).compile();
    service = moduleRef.get(WishlistService);
    users = moduleRef.get(UserRepository);
    wishlists = moduleRef.get(WishlistRepository);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await testDb.close();
  });

  async function activeUser(): Promise<ActiveUser> {
    const user: User = value(await users.insert(makeUser()).toPromise());
    return { ...user, status: 'active' };
  }

  async function stored(user: ActiveUser): Promise<Wishlist[]> {
    return value(await wishlists.all(QueryScope.user(user.id)).toPromise());
  }

  async function failureName(
    result: AsyncResult<unknown, { name: string }>,
  ): Promise<string> {
    return result.match({
      ok: () => {
        throw new Error('expected a failure');
      },
      err: (failure) => failure.name,
    });
  }

  describe('create', () => {
    it('stores a published surprise Wishlist owned by the caller', async () => {
      const user = await activeUser();

      const wishlist = value(
        await service.create(user, { name: 'Birthday' }).toPromise(),
      );

      expect(wishlist.user).toBe(user.id);
      expect(wishlist.name).toBe('Birthday');
      expect(wishlist.slug).toBeTruthy();
      expect(wishlist.published).toBe(true);
      expect(wishlist.style).toBe('surprise');
      expect(await stored(user)).toEqual([wishlist]);
    });

    it('keeps an explicit default style', async () => {
      const user = await activeUser();

      const wishlist = value(
        await service
          .create(user, { name: 'Birthday', style: 'default' })
          .toPromise(),
      );

      expect(wishlist.style).toBe('default');
    });

    it('reports an empty name as invalid and stores nothing', async () => {
      const user = await activeUser();

      expect(await failureName(service.create(user, { name: '' }))).toBe(
        'invalid',
      );
      expect(await stored(user)).toEqual([]);
    });

    it('reports a database failure as unexpected', async () => {
      const user = await activeUser();
      vi.spyOn(WishlistRepository.prototype, 'insert').mockReturnValue(
        AsyncResult.fromResult(
          err(DatabaseFailure.query(new Error('disk I/O error'))),
        ),
      );

      expect(
        await failureName(service.create(user, { name: 'Birthday' })),
      ).toBe('unexpected');
    });
  });

  describe('list', () => {
    it("returns only the caller's Wishlists", async () => {
      const user = await activeUser();
      const other = await activeUser();
      const mine = value(
        await service.create(user, { name: 'Birthday' }).toPromise(),
      );
      value(await service.create(other, { name: 'Holidays' }).toPromise());

      expect(value(await service.list(user).toPromise())).toEqual([mine]);
    });

    it('returns an empty list for a User with none', async () => {
      const user = await activeUser();

      expect(value(await service.list(user).toPromise())).toEqual([]);
    });

    it('reports a database failure as unexpected', async () => {
      const user = await activeUser();
      vi.spyOn(WishlistRepository.prototype, 'all').mockReturnValue(
        AsyncResult.fromResult(
          err(DatabaseFailure.query(new Error('disk I/O error'))),
        ),
      );

      expect(await failureName(service.list(user))).toBe('unexpected');
    });
  });
});

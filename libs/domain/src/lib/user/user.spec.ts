import { expectTypeOf } from 'vitest';
import { Failure } from '@wish-list/common-error';
import { Option, type Result } from '@wish-list/common-result';
import { Identity } from '../identity/identity.js';
import { User } from './user.js';
import type { FreeUser, ProUser } from './user.js';

function ok<T>(result: Result<T, unknown>): T {
  return result.match({
    ok: (value) => value,
    err: (error) => {
      throw error;
    },
  });
}

function some<T>(option: Option<T>): T {
  return option.match({
    some: (value) => value,
    none: () => {
      throw new Error('expected Some');
    },
  });
}

function identity(overrides: Partial<Identity.CreateInput> = {}): Identity {
  return ok(
    Identity.create({
      providerId: 'uid-1',
      provider: 'google',
      email: 'jane.doe@example.com',
      name: Option.some('Jane Doe'),
      ...overrides,
    }),
  );
}

describe('User.create', () => {
  const validInput = {
    email: 'user@example.com',
    name: 'Ada Lovelace',
    provider: 'google',
    providerId: 'google-123',
  };

  it('produces a FreeUser with a generated id, plan free, and equal timestamps', () => {
    const result = User.create(validInput);
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    const user = result.value;
    expect(user.id).toBeTruthy();
    expect(user.plan).toBe('free');
    expect(user.email).toBe('user@example.com');
    expect(user.name).toBe(validInput.name);
    expect(user.provider).toBe(validInput.provider);
    expect(user.providerId).toBe(validInput.providerId);
    expect(user.createdAt).toEqual(user.updatedAt);
    expect(user.nameSource).toBe('broker');
  });

  it('rejects an invalid email', () => {
    const result = User.create({ ...validInput, email: 'not-an-email' });
    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe('validation');
    expect(result.error.source).toBeInstanceOf(Failure);
    const source = result.error.source as Failure;
    expect(source.metadata['issues']).toBeDefined();
  });

  it('rejects an empty name', () => {
    const result = User.create({ ...validInput, name: '' });
    expect(result.isErr()).toBe(true);
  });

  it('rejects an empty provider', () => {
    const result = User.create({ ...validInput, provider: '' });
    expect(result.isErr()).toBe(true);
  });

  it('rejects an empty providerId', () => {
    const result = User.create({ ...validInput, providerId: '' });
    expect(result.isErr()).toBe(true);
  });
});

describe('User round-trip', () => {
  it('deep-equals the original FreeUser', () => {
    const result = User.create({
      email: 'free@example.com',
      name: 'Free Person',
      provider: 'google',
      providerId: 'google-1',
    });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    const user = result.value;
    expect(User.from(User.plain(user))).toEqual(user);
  });

  it('deep-equals the original ProUser-shaped input', () => {
    const result = User.create({
      email: 'pro@example.com',
      name: 'Pro Person',
      provider: 'github',
      providerId: 'github-1',
    });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    const proUser = { ...result.value, plan: 'pro' as const };
    expect(User.from(User.plain(proUser))).toEqual(proUser);
  });
});

describe('User plan narrowing', () => {
  it('does not allow a FreeUser where a ProUser is expected', () => {
    expectTypeOf<FreeUser>().not.toExtend<ProUser>();
  });

  it('does not allow a ProUser where a FreeUser is expected', () => {
    expectTypeOf<ProUser>().not.toExtend<FreeUser>();
  });
});

describe('User.fromIdentity', () => {
  it('uses the reported name', () => {
    const user = ok(User.fromIdentity(identity()));
    expect(user.name).toBe('Jane Doe');
    expect(user.nameSource).toBe('broker');
    expect(user.email).toBe('jane.doe@example.com');
    expect(user.provider).toBe('google');
    expect(user.providerId).toBe('uid-1');
    expect(user.plan).toBe('free');
  });

  it("falls back to the email's local part when no name was reported", () => {
    const user = ok(User.fromIdentity(identity({ name: Option.none() })));
    expect(user.name).toBe('jane.doe');
    expect(user.nameSource).toBe('broker');
  });
});

describe('User.sync', () => {
  const brokerUser = ok(User.fromIdentity(identity()));
  const renamedUser = ok(User.rename(brokerUser, 'JD'));

  it('returns None when nothing changed', () => {
    expect(User.sync(brokerUser, identity()).isNone()).toBe(true);
  });

  it('re-syncs a changed name while nameSource is broker', () => {
    const synced = User.sync(
      brokerUser,
      identity({ name: Option.some('Jane D') }),
    );
    expect(synced.isSome()).toBe(true);
    expect(synced.map((u) => u.name).unwrapOr('')).toBe('Jane D');
    expect(synced.map((u) => u.nameSource).unwrapOr('user')).toBe('broker');
  });

  it('keeps the stored name when the broker reports none', () => {
    expect(
      User.sync(brokerUser, identity({ name: Option.none() })).isNone(),
    ).toBe(true);
  });

  it('never overwrites a user-edited name', () => {
    expect(
      User.sync(
        renamedUser,
        identity({ name: Option.some('Jane D') }),
      ).isNone(),
    ).toBe(true);
    expect(
      User.sync(renamedUser, identity({ name: Option.none() })).isNone(),
    ).toBe(true);
  });

  it('re-syncs email and provider even for a user-edited name', () => {
    const synced = some(
      User.sync(
        renamedUser,
        identity({ email: 'jane@new.example', provider: 'github' }),
      ),
    );
    expect(synced.email).toBe('jane@new.example');
    expect(synced.provider).toBe('github');
    expect(synced.name).toBe('JD');
    expect(synced.nameSource).toBe('user');
  });

  it('bumps updatedAt and keeps id, plan and createdAt', () => {
    const synced = some(
      User.sync(brokerUser, identity({ provider: 'github' })),
    );
    expect(synced.id).toBe(brokerUser.id);
    expect(synced.plan).toBe(brokerUser.plan);
    expect(synced.createdAt).toBe(brokerUser.createdAt);
    expect(synced.updatedAt.getTime()).toBeGreaterThanOrEqual(
      brokerUser.updatedAt.getTime(),
    );
  });
});

describe('User.rename', () => {
  const user = ok(User.fromIdentity(identity()));

  it('sets the name and marks it user-written', () => {
    const renamed = ok(User.rename(user, 'JD'));
    expect(renamed.name).toBe('JD');
    expect(renamed.nameSource).toBe('user');
    expect(renamed.id).toBe(user.id);
  });

  it('rejects an empty name', () => {
    const result = User.rename(user, '');
    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe('validation');
  });

  it('keeps the plan narrowing', () => {
    expectTypeOf(ok(User.rename(user, 'JD'))).toExtend<FreeUser>();
  });
});

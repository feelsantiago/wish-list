import { expectTypeOf } from 'vitest';
import { Failure } from '@wish-list/common-error';
import { User } from './user.js';
import type { FreeUser, ProUser } from './user.js';

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

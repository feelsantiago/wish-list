import { describe, expect, it } from 'vitest';
import { Env } from './env.js';

const REQUIRED = {
  FIREBASE_PROJECT_ID: 'wishlist-test',
  LLM_API_KEY: 'key',
  LLM_MODEL: 'model',
};

describe('Env', () => {
  describe('DATABASE_AUTH_TOKEN', () => {
    it('is None for a local file database without a token', () => {
      const env = Env.$.parse({ ...REQUIRED, DATABASE_URL: 'file:./local.db' });

      expect(env.DATABASE_AUTH_TOKEN.isNone()).toBe(true);
    });

    it('accepts an in-memory database without a token', () => {
      expect(
        Env.$.safeParse({ ...REQUIRED, DATABASE_URL: ':memory:' }).success,
      ).toBe(true);
    });

    it('is Some when given', () => {
      const env = Env.$.parse({
        ...REQUIRED,
        DATABASE_URL: 'libsql://wishlist-staging.turso.io',
        DATABASE_AUTH_TOKEN: 'token',
      });

      expect(env.DATABASE_AUTH_TOKEN.unwrapOr('')).toBe('token');
    });

    it.each([
      'libsql://wishlist-staging.turso.io',
      'https://wishlist-staging.turso.io',
    ])('is required for the remote URL %s', (url) => {
      const result = Env.$.safeParse({ ...REQUIRED, DATABASE_URL: url });

      expect(result.success).toBe(false);
      expect(result.error?.issues).toEqual([
        expect.objectContaining({ path: ['DATABASE_AUTH_TOKEN'] }),
      ]);
    });

    it('applies the same rule to the migrator schema', () => {
      expect(
        Env.database.safeParse({ DATABASE_URL: 'libsql://db.turso.io' })
          .success,
      ).toBe(false);
      expect(
        Env.database.safeParse({ DATABASE_URL: 'file:./local.db' }).success,
      ).toBe(true);
    });

    it('rejects an empty token', () => {
      expect(
        Env.$.safeParse({
          ...REQUIRED,
          DATABASE_URL: 'file:./local.db',
          DATABASE_AUTH_TOKEN: '',
        }).success,
      ).toBe(false);
    });
  });
});

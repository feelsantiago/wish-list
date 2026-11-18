import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Option } from '@wish-list/common-result';
import type { Identity } from '@wish-list/domain';
import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type CryptoKey,
  type JWTPayload,
} from 'jose';
import { AuthFailure } from './auth-failure.js';
import type { AuthFailure as AuthFailureType } from './auth-failure.js';
import { AuthenticationModule } from './authentication.module.js';
import { IdentityVerifier } from './identity-verifier.js';

const PROJECT_ID = 'wish-list-test';
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;
const KID = 'test-key';

describe('IdentityVerifier', () => {
  let privateKey: CryptoKey;
  let verifier: IdentityVerifier;

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256');
    privateKey = pair.privateKey;
    const jwk = {
      ...(await exportJWK(pair.publicKey)),
      kid: KID,
      alg: 'RS256',
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        AuthenticationModule.forRoot({
          projectId: PROJECT_ID,
          jwks: createLocalJWKSet({ keys: [jwk] }),
        }),
      ],
    }).compile();
    verifier = moduleRef.get(IdentityVerifier);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function claims(overrides: JWTPayload = {}): JWTPayload {
    return {
      email: 'jane.doe@example.com',
      name: 'Jane Doe',
      firebase: { sign_in_provider: 'google.com' },
      ...overrides,
    };
  }

  interface SignOptions {
    readonly subject?: string;
    readonly issuer?: string;
    readonly audience?: string;
    readonly expiresAt?: number | string;
  }

  function sign(
    payload: JWTPayload = claims(),
    options: SignOptions = {},
  ): Promise<string> {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', kid: KID })
      .setSubject(options.subject ?? 'uid-1')
      .setIssuer(options.issuer ?? ISSUER)
      .setAudience(options.audience ?? PROJECT_ID)
      .setIssuedAt()
      .setExpirationTime(options.expiresAt ?? '1h')
      .sign(privateKey);
  }

  function bearer(token: string): Option<string> {
    return Option.some(`Bearer ${token}`);
  }

  async function identity(header: Option<string>): Promise<Identity> {
    return verifier.verify(header).match({
      ok: (value) => value,
      err: (failure) => {
        throw failure;
      },
    });
  }

  async function refusal(header: Option<string>): Promise<AuthFailureType> {
    return verifier.verify(header).match({
      ok: () => {
        throw new Error('expected a refusal');
      },
      err: (failure) => failure,
    });
  }

  async function reason(header: Option<string>): Promise<string> {
    return AuthFailure.reason(await refusal(header));
  }

  describe('accepts', () => {
    it('a valid Google token', async () => {
      const result = await identity(bearer(await sign()));
      expect(result.providerId).toBe('uid-1');
      expect(result.provider).toBe('google');
      expect(result.email).toBe('jane.doe@example.com');
      expect(result.name.unwrapOr('')).toBe('Jane Doe');
    });

    it('a valid GitHub token', async () => {
      const token = await sign(
        claims({ firebase: { sign_in_provider: 'github.com' } }),
      );
      expect((await identity(bearer(token))).provider).toBe('github');
    });

    it('a token without a name, as Option.none', async () => {
      const token = await sign(claims({ name: undefined }));
      expect((await identity(bearer(token))).name.isNone()).toBe(true);
    });

    it('a lowercase bearer scheme', async () => {
      const token = await sign();
      expect((await identity(Option.some(`bearer ${token}`))).providerId).toBe(
        'uid-1',
      );
    });
  });

  describe('refuses with missing-token', () => {
    it.each([
      ['no header', Option.none<string>()],
      ['an empty header', Option.some('')],
      ['another scheme', Option.some('Basic dXNlcjpwYXNz')],
      ['a scheme without a token', Option.some('Bearer')],
      ['two tokens', Option.some('Bearer a b')],
    ])('%s', async (_, header) => {
      expect(await reason(header)).toBe('missing-token');
    });
  });

  describe('refuses with invalid-token', () => {
    it('a token that is not a JWT', async () => {
      expect(await reason(bearer('not-a-jwt'))).toBe('invalid-token');
    });

    it('an expired token', async () => {
      const token = await sign(claims(), {
        expiresAt: Math.floor(Date.now() / 1000) - 60,
      });
      expect(await reason(bearer(token))).toBe('invalid-token');
    });

    it('a wrong audience', async () => {
      const token = await sign(claims(), { audience: 'another-project' });
      expect(await reason(bearer(token))).toBe('invalid-token');
    });

    it('a wrong issuer', async () => {
      const token = await sign(claims(), {
        issuer: 'https://securetoken.google.com/another-project',
      });
      expect(await reason(bearer(token))).toBe('invalid-token');
    });

    it('an HS256 token', async () => {
      const token = await new SignJWT(claims())
        .setProtectedHeader({ alg: 'HS256', kid: KID })
        .setSubject('uid-1')
        .setIssuer(ISSUER)
        .setAudience(PROJECT_ID)
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode('a-shared-secret-of-sufficient-length'));
      expect(await reason(bearer(token))).toBe('invalid-token');
    });

    it('a token signed by another key', async () => {
      const other = await generateKeyPair('RS256');
      const token = await new SignJWT(claims())
        .setProtectedHeader({ alg: 'RS256', kid: KID })
        .setSubject('uid-1')
        .setIssuer(ISSUER)
        .setAudience(PROJECT_ID)
        .setExpirationTime('1h')
        .sign(other.privateKey);
      expect(await reason(bearer(token))).toBe('invalid-token');
    });

    it('an empty subject', async () => {
      const token = await sign(claims(), { subject: '' });
      expect(await reason(bearer(token))).toBe('invalid-token');
    });

    it('a malformed email', async () => {
      const token = await sign(claims({ email: 'not-an-email' }));
      expect(await reason(bearer(token))).toBe('invalid-token');
    });
  });

  describe('refuses with provider-not-allowed', () => {
    it.each(['password', 'anonymous', 'phone'])('%s', async (provider) => {
      const token = await sign(
        claims({ firebase: { sign_in_provider: provider } }),
      );
      const failure = await refusal(bearer(token));
      expect(AuthFailure.reason(failure)).toBe('provider-not-allowed');
      expect(failure.metadata['provider']).toBe(provider);
    });
  });

  describe('refuses with missing-email', () => {
    it.each([
      ['no email claim', undefined],
      ['an empty email claim', ''],
    ])('%s', async (_, email) => {
      const token = await sign(claims({ email }));
      expect(await reason(bearer(token))).toBe('missing-email');
    });
  });

  it('every refusal is the unauthenticated tag', async () => {
    expect((await refusal(Option.none())).name).toBe('unauthenticated');
    expect((await refusal(bearer('not-a-jwt'))).name).toBe('unauthenticated');
  });

  describe('logging', () => {
    it('logs a missing token at debug', async () => {
      const debug = vi.spyOn(Logger.prototype, 'debug');
      const warn = vi.spyOn(Logger.prototype, 'warn');
      await refusal(Option.none());
      expect(debug).toHaveBeenCalledWith(
        'Authentication refused: missing-token',
      );
      expect(warn).not.toHaveBeenCalled();
    });

    it('logs other refusals at warn, without the token', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn');
      const token = await sign(claims(), { audience: 'another-project' });
      await refusal(bearer(token));
      expect(warn).toHaveBeenCalledWith(
        'Authentication refused: invalid-token',
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain(token);
    });

    it('logs nothing on success', async () => {
      const debug = vi.spyOn(Logger.prototype, 'debug');
      const warn = vi.spyOn(Logger.prototype, 'warn');
      await identity(bearer(await sign()));
      expect(debug).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    });
  });
});

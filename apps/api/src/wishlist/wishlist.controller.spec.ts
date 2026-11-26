import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AccountService } from '@wish-list/account-service';
import { AuthFailure, IdentityVerifier } from '@wish-list/authentication';
import { HttpEdgeModule } from '@wish-list/common-http';
import { LoggingModule } from '@wish-list/common-logging';
import { AsyncResult, Option } from '@wish-list/common-result';
import {
  createTestDatabase,
  databaseTestingProviders,
} from '@wish-list/database/testing';
import type { TestDatabase } from '@wish-list/database/testing';
import { Identity, Wishlist } from '@wish-list/domain';
import type { WishlistResponse } from '@wish-list/wishlist-data';
import { WishlistService } from '@wish-list/wishlist-service';
import { AuthGuard } from '../auth/auth.guard.js';
import { WishlistController } from './wishlist.controller.js';

/** `Bearer <providerId>` verifies to an Identity with that providerId. */
class FakeIdentityVerifier {
  public verify(header: Option<string>): AsyncResult<Identity, AuthFailure> {
    return AsyncResult.fromResult(
      header
        .andThen((value) => Option.from(/^Bearer (\S+)$/.exec(value)?.[1]))
        .okOrElse(() => AuthFailure.missingToken())
        .andThen((providerId) =>
          Identity.create({
            providerId,
            provider: 'google',
            email: `${providerId}@example.com`,
            name: Option.some(providerId),
          }).mapErr(() => AuthFailure.missingToken()),
        ),
    );
  }
}

type Reply = { readonly status: number; readonly body: unknown };

describe('WishlistController', () => {
  let testDb: TestDatabase;
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    const moduleRef = await Test.createTestingModule({
      imports: [
        LoggingModule.forRootAsync({
          useFactory: () => ({
            level: 'silent',
            pretty: false,
            requestIdHeader: 'x-request-id',
          }),
        }),
        HttpEdgeModule.forRoot({ exposeFailures: false }),
      ],
      controllers: [WishlistController],
      providers: [
        ...databaseTestingProviders(testDb.db),
        AccountService,
        WishlistService,
        { provide: IdentityVerifier, useClass: FakeIdentityVerifier },
        { provide: APP_GUARD, useClass: AuthGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0);
    base = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
    await testDb.close();
  });

  async function call(
    method: 'GET' | 'POST',
    token: Option<string>,
    body: Option<unknown> = Option.none(),
  ): Promise<Reply> {
    const res = await fetch(`${base}/wishlists`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...token.match({
          some: (t) => ({ authorization: `Bearer ${t}` }),
          none: () => ({}),
        }),
      },
      ...body.match({
        some: (b) => ({ body: JSON.stringify(b) }),
        none: () => ({}),
      }),
    });
    return { status: res.status, body: await res.json() };
  }

  function create(token: string, body: unknown): Promise<Reply> {
    return call('POST', Option.some(token), Option.some(body));
  }

  function list(token: string): Promise<Reply> {
    return call('GET', Option.some(token));
  }

  function data<T>(reply: Reply): T {
    return (reply.body as { data: T }).data;
  }

  describe('POST /wishlists', () => {
    it('creates a Wishlist and returns its Plain form as created', async () => {
      const reply = await create('alice', { name: 'Birthday' });

      expect(reply.status).toBe(201);
      expect(reply.body).toMatchObject({
        status: 'created',
        data: { name: 'Birthday', style: 'surprise', published: true },
      });
      const wishlist = data<WishlistResponse>(reply);
      expect(typeof wishlist.createdAt).toBe('string');
      expect(Wishlist.plain(Wishlist.from(wishlist))).toEqual(wishlist);
    });

    it('rejects an empty name with the validation issues', async () => {
      const reply = await create('alice', { name: '' });

      expect(reply.status).toBe(400);
      expect(reply.body).toMatchObject({
        status: 'error',
        error: { issues: [expect.objectContaining({ path: 'name' })] },
      });
    });

    it('makes the caller the owner, whatever the body says', async () => {
      const bob = data<WishlistResponse[]>(await list('bob'));
      const reply = await create('alice', {
        name: 'Spoofed',
        user: '00000000-0000-4000-8000-000000000000',
      });
      const alice = data<WishlistResponse[]>(await list('alice'));

      expect(reply.status).toBe(201);
      expect(alice).toContainEqual(data<WishlistResponse>(reply));
      expect(data<WishlistResponse>(reply).user).not.toBe(
        '00000000-0000-4000-8000-000000000000',
      );
      expect(bob).toEqual([]);
    });

    it('refuses a request without a token', async () => {
      const reply = await call(
        'POST',
        Option.none(),
        Option.some({ name: 'Birthday' }),
      );

      expect(reply.status).toBe(401);
    });
  });

  describe('GET /wishlists', () => {
    it("lists only the caller's Wishlists", async () => {
      const mine = data<WishlistResponse>(
        await create('carol', { name: 'Carol list' }),
      );
      await create('dave', { name: 'Dave list' });

      const reply = await list('carol');

      expect(reply.status).toBe(200);
      expect(reply.body).toEqual({ status: 'success', data: [mine] });
    });

    it('returns an empty list for a caller with none', async () => {
      expect((await list('erin')).body).toEqual({
        status: 'success',
        data: [],
      });
    });

    it('refuses a request without a token', async () => {
      expect((await call('GET', Option.none())).status).toBe(401);
    });
  });
});

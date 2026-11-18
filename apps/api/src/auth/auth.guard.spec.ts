import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Controller, Get } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ServiceFailure } from '@wish-list/common-error/service';
import { HttpEdgeModule } from '@wish-list/common-http';
import { LoggingModule } from '@wish-list/common-logging';
import { AsyncResult, Option, err } from '@wish-list/common-result';
import type { Result } from '@wish-list/common-result';
import { AccountService } from '@wish-list/account-service';
import {
  AuthFailure,
  IdentityVerifier,
  Public,
} from '@wish-list/authentication';
import { Identity, User } from '@wish-list/domain';
import type { ActiveUser } from '@wish-list/domain';
import { match } from 'ts-pattern';
import { AuthGuard } from './auth.guard.js';
import { CurrentUser } from './current-user.decorator.js';

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
            name: Option.some('Jane'),
          }).mapErr(() => AuthFailure.missingToken()),
        ),
    );
  }
}

/** providerId `deactivated` resolves to a deactivated User, `broken` fails. */
class FakeAccountService {
  public resolve(identity: Identity): AsyncResult<User, ServiceFailure> {
    const user = User.fromIdentity(identity).mapErr((failure): ServiceFailure =>
      ServiceFailure.unexpected(failure),
    );
    return AsyncResult.fromResult(
      match<string, Result<User, ServiceFailure>>(identity.providerId)
        .with('broken', () =>
          err(ServiceFailure.unexpected(new Error('db down'))),
        )
        .with('deactivated', () =>
          user.map((u): User => ({
            ...u,
            status: 'deactivated',
            deactivatedAt: Option.some(new Date()),
          })),
        )
        .otherwise(() => user),
    );
  }
}

@Controller('probe')
class ProbeController {
  @Public()
  @Get('public')
  public open(): { open: true } {
    return { open: true };
  }

  @Get('me')
  public me(@CurrentUser() user: ActiveUser): {
    providerId: string;
    status: string;
  } {
    return { providerId: user.providerId, status: user.status };
  }
}

@Public()
@Controller('open')
class OpenController {
  @Get()
  public open(): { open: true } {
    return { open: true };
  }
}

describe('AuthGuard', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
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
      controllers: [ProbeController, OpenController],
      providers: [
        { provide: IdentityVerifier, useClass: FakeIdentityVerifier },
        { provide: AccountService, useClass: FakeAccountService },
        { provide: APP_GUARD, useClass: AuthGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0);
    base = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  function get(
    path: string,
    token: Option<string> = Option.none(),
  ): Promise<Response> {
    return fetch(`${base}${path}`, {
      headers: token.match({
        some: (t) => ({ authorization: `Bearer ${t}` }),
        none: () => ({}),
      }),
    });
  }

  it('passes a @Public() route without a token', async () => {
    const res = await get('/probe/public');
    expect(res.status).toBe(200);
  });

  it('passes every route of a @Public() controller', async () => {
    const res = await get('/open');
    expect(res.status).toBe(200);
  });

  it('refuses a protected route without a token: 401 with WWW-Authenticate', async () => {
    const res = await get('/probe/me');
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe('Bearer');
    expect(await res.json()).toEqual({
      status: 'error',
      error: { message: 'Unauthorized' },
    });
  });

  it('refuses a deactivated User: 403 without WWW-Authenticate', async () => {
    const res = await get('/probe/me', Option.some('deactivated'));
    expect(res.status).toBe(403);
    expect(res.headers.get('www-authenticate')).toBeNull();
    expect(await res.json()).toEqual({
      status: 'error',
      error: { message: 'Account deactivated' },
    });
  });

  it('hides a resolve failure behind a 500', async () => {
    const res = await get('/probe/me', Option.some('broken'));
    expect(res.status).toBe(500);
  });

  it('puts the resolved ActiveUser on the request for @CurrentUser()', async () => {
    const res = await get('/probe/me', Option.some('uid-1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: 'success',
      data: { providerId: 'uid-1', status: 'active' },
    });
  });
});

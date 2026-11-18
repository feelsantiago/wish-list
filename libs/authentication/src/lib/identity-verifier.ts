import { Inject, Injectable, Logger } from '@nestjs/common';
import { Failure } from '@wish-list/common-error';
import { AsyncResult, Option, Result } from '@wish-list/common-result';
import { Identity } from '@wish-list/domain';
import { jwtVerify } from 'jose';
import type { JWTPayload, JWTVerifyGetKey } from 'jose';
import { match } from 'ts-pattern';
import { z, ZodError } from 'zod';
import { AuthFailure } from './auth-failure.js';
import {
  MODULE_OPTIONS_TOKEN,
  type AuthenticationModuleOptions,
} from './authentication.options.js';
import { JWKS } from './jwks.provider.js';

/**
 * Turns an `Authorization` header into a verified `Identity` (ADR-0034,
 * ADR-0038). Firebase claim names and the provider allowlist live here and
 * nowhere else. Logs why a token was refused, never the token (ADR-0037).
 */
@Injectable()
export class IdentityVerifier {
  private static readonly ISSUER_PREFIX = 'https://securetoken.google.com/';

  private static readonly BEARER = /^Bearer +([^\s]+)$/i;

  /** Closed list: `sign_in_provider` → `Identity.provider` (ADR-0034). */
  private static readonly PROVIDERS: ReadonlyMap<string, string> = new Map([
    ['google.com', 'google'],
    ['github.com', 'github'],
  ]);

  private static readonly Claims = z.object({
    sub: z.string().min(1),
    email: z.string().optional(),
    name: z.string().optional(),
    firebase: z.object({ sign_in_provider: z.string() }),
  });

  private readonly logger = new Logger(IdentityVerifier.name);

  public constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthenticationModuleOptions,
    @Inject(JWKS) private readonly jwks: JWTVerifyGetKey,
  ) {}

  public verify(header: Option<string>): AsyncResult<Identity, AuthFailure> {
    return AsyncResult.fromResult(
      this.token(header).okOrElse(() => AuthFailure.missingToken()),
    )
      .andThen((token) => this.payload(token))
      .andThen((payload) => this.identity(payload))
      .inspectErr((failure) => this.log(failure));
  }

  private token(header: Option<string>): Option<string> {
    return header.andThen((value) =>
      Option.from(IdentityVerifier.BEARER.exec(value.trim())?.[1]),
    );
  }

  private payload(token: string): AsyncResult<JWTPayload, AuthFailure> {
    return AsyncResult.fromThrowable(
      () =>
        jwtVerify(token, this.jwks, {
          algorithms: ['RS256'],
          issuer: `${IdentityVerifier.ISSUER_PREFIX}${this.options.projectId}`,
          audience: this.options.projectId,
        }).then(({ payload }) => payload),
      (error) => AuthFailure.invalidToken(Failure.from(error)),
    );
  }

  private identity(payload: JWTPayload): Result<Identity, AuthFailure> {
    return Result.fromThrowable<
      z.infer<typeof IdentityVerifier.Claims>,
      ZodError
    >(() => IdentityVerifier.Claims.parse(payload))
      .mapErr((error) => AuthFailure.invalidToken(error))
      .andThen((claims) =>
        this.provider(claims.firebase.sign_in_provider).andThen((provider) =>
          Option.from(claims.email)
            .filter((email) => email.length > 0)
            .okOrElse(() => AuthFailure.missingEmail())
            .andThen((email) =>
              Identity.create({
                providerId: claims.sub,
                provider,
                email,
                name: Option.from(claims.name),
              }).mapErr((failure) => AuthFailure.invalidToken(failure)),
            ),
        ),
      );
  }

  private provider(signInProvider: string): Result<string, AuthFailure> {
    return Option.from(IdentityVerifier.PROVIDERS.get(signInProvider)).okOrElse(
      () => AuthFailure.providerNotAllowed(signInProvider),
    );
  }

  /** `debug` for a missing token (every crawler hit), `warn` otherwise. */
  private log(failure: AuthFailure): void {
    const reason = AuthFailure.reason(failure);
    const message = `Authentication refused: ${reason}`;
    match(reason)
      .with('missing-token', () => this.logger.debug(message))
      .otherwise(() => this.logger.warn(message));
  }
}

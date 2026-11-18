import { Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { match } from 'ts-pattern';
import { ServiceFailure } from '@wish-list/common-error/service';
import { FailureHttpException, FailureStatus } from '@wish-list/common-http';
import { Option, err, ok } from '@wish-list/common-result';
import type { Result } from '@wish-list/common-result';
import { AccountService } from '@wish-list/account-service';
import { IS_PUBLIC, IdentityVerifier } from '@wish-list/authentication';
import type { ActiveUser, User } from '@wish-list/domain';
import type { AuthenticatedRequest } from './authenticated-request.js';

/**
 * Global guard (ADR-0038): `@Public()` routes pass untouched; every other
 * route needs a verified token, a resolved local `User`, and that User
 * active (ADR-0039). Guards run before interceptors, so failures are thrown
 * as `FailureHttpException` for `FailureFilter` (ADR-0037).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  public constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(IdentityVerifier) private readonly verifier: IdentityVerifier,
    @Inject(AccountService) private readonly accounts: AccountService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    return match(this.isPublic(context))
      .with(true, () => Promise.resolve(true))
      .with(false, () => this.authenticate(context))
      .exhaustive();
  }

  private isPublic(context: ExecutionContext): boolean {
    return Option.from(
      this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ]),
    ).unwrapOr(false);
  }

  private async authenticate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    request.user = await this.verifier
      .verify(Option.from(request.headers.authorization))
      .mapErr((failure): ServiceFailure => failure)
      .andThen((identity) => this.accounts.resolve(identity))
      .andThen((user) => this.active(user))
      .match({
        ok: (user) => user,
        err: (failure) => {
          throw this.exception(failure);
        },
      });

    return true;
  }

  /** ADR-0039: a deactivated User is refused on every protected route. */
  private active(user: User): Result<ActiveUser, ServiceFailure> {
    return match(user)
      .with({ status: 'active' }, (active) => ok(active))
      .with({ status: 'deactivated' }, (deactivated) =>
        err(ServiceFailure.userDeactivated(deactivated.id)),
      )
      .exhaustive();
  }

  /** RFC 7235: a 401 names the scheme it wants, nothing more (ADR-0037). */
  private exception(failure: ServiceFailure): FailureHttpException {
    const { status, message } = FailureStatus.response(failure.name);
    const headers = match(failure.name)
      .with('unauthenticated', () => ({ 'WWW-Authenticate': 'Bearer' }))
      .otherwise(() => ({}));
    return new FailureHttpException(failure, status, message, headers);
  }
}

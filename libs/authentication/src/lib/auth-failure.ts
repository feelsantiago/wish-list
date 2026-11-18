import { Failure } from '@wish-list/common-error';
import { ServiceFailure } from '@wish-list/common-error/service';

/**
 * Every refusal is the single shared `'unauthenticated'` tag; the cause lives
 * in the closed `reason` metadata field and never reaches a response body
 * (ADR-0037).
 */
export type AuthFailure = Failure<'unauthenticated'>;

export type AuthFailureReason =
  'missing-token' | 'invalid-token' | 'provider-not-allowed' | 'missing-email';

export namespace AuthFailure {
  /** No `Authorization: Bearer <token>` header. */
  export function missingToken(): AuthFailure {
    return ServiceFailure.unauthenticated('missing-token');
  }

  /** Bad signature, wrong `iss`/`aud`, expired, malformed claims. */
  export function invalidToken(cause: Error): AuthFailure {
    return Failure.from(
      cause,
      { reason: 'invalid-token' satisfies AuthFailureReason },
      'unauthenticated',
    );
  }

  /** `sign_in_provider` is not on ADR-0034's allowlist. */
  export function providerNotAllowed(provider: string): AuthFailure {
    return ServiceFailure.unauthenticated('provider-not-allowed').withMetadata({
      provider,
    });
  }

  /** No `email` claim (ADR-0034). */
  export function missingEmail(): AuthFailure {
    return ServiceFailure.unauthenticated('missing-email');
  }

  export function reason(failure: AuthFailure): string {
    return String(failure.metadata['reason']);
  }
}

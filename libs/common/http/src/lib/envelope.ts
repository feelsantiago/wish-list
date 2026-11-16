import type { RenderedFailure } from '@wish-list/common-logging';

export type ValidationIssue = {
  readonly path: string;
  readonly message: string;
};

export type ErrorBody = {
  readonly message: string;
  /** Present on request validation failures: they describe the caller's input. */
  readonly issues?: ValidationIssue[];
  /** Present only when `exposeFailures` is on. */
  readonly failure?: RenderedFailure['failure'];
};

export type SuccessEnvelope<T> = {
  readonly status: 'success' | 'created';
  readonly data: T;
};

export type ErrorEnvelope = {
  readonly status: 'error';
  readonly error: ErrorBody;
};

export type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

export namespace Envelope {
  export function success<T>(data: T): SuccessEnvelope<T> {
    return { status: 'success', data };
  }

  export function created<T>(data: T): SuccessEnvelope<T> {
    return { status: 'created', data };
  }

  export function error(body: ErrorBody): ErrorEnvelope {
    return { status: 'error', error: body };
  }
}

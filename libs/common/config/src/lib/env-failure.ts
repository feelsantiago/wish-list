import { Failure } from '@wish-list/common-error';
import type { ZodError } from 'zod';

export type EnvFailure = Failure<'invalid-env'>;

export namespace EnvFailure {
  export function invalid(error: ZodError): EnvFailure {
    return Failure.from(error, { issues: error.message }, 'invalid-env');
  }
}

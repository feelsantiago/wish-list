import { Failure } from '@wish-list/common-error';
import type { ZodError } from 'zod';

export interface DomainValidationError {
  readonly field: string;
  readonly message: string;
}

function fromZodError(error: ZodError): DomainValidationError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

export type DomainFailureType = 'validation';
export type DomainFailure = Failure<DomainFailureType>;

export namespace DomainFailure {
  export function validation(
    input: unknown,
    errors: ZodError | DomainValidationError[],
  ): Failure<'validation'> {
    return Failure.create('validation', 'Validation failed', {
      input,
      issues: Array.isArray(errors) ? errors : fromZodError(errors),
    });
  }
}

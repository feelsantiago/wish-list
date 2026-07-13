import { z, ZodError } from 'zod';
import { Result } from '@wish-list/common-result';
import type { Brand } from '../brand/brand.js';
import { DomainFailure } from '../domain-failure/domain-failure.js';

export type Email = Brand<string, 'Email'>;

export namespace Email {
  export const $ = z
    .string()
    .email()
    .transform((v) => v.toLowerCase());

  export function create(input: string): Result<Email, DomainFailure> {
    return Result.fromThrowable<string, ZodError>(() => $.parse(input))
      .mapErr((error) =>
        DomainFailure.validation(input, error).context('Creating Email'),
      )
      .map((email) => from(email));
  }

  export function from(value: string): Email {
    return value as Email;
  }
}

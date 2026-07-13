import { randomUUID } from 'node:crypto';
import { z, ZodError } from 'zod';
import { Result } from '@wish-list/common-result';
import type { Brand } from '../brand/brand.js';
import { DomainFailure } from '../domain-failure/domain-failure.js';

export type Id = Brand<string, 'Id'>;

export namespace Id {
  export const $ = z.string().uuid();

  export function generate(): Id {
    return randomUUID() as unknown as Id;
  }

  export function create(input: string): Result<Id, DomainFailure> {
    return Result.fromThrowable<string, ZodError>(() => $.parse(input))
      .mapErr((error) =>
        DomainFailure.validation(input, error).context('Creating Id'),
      )
      .map((value) => from(value));
  }

  export function from(value: string): Id {
    return value as Id;
  }
}

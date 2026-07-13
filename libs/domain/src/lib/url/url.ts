import { z, ZodError } from 'zod';
import { Result } from '@wish-list/common-result';
import type { Brand } from '../brand/brand.js';
import { DomainFailure } from '../domain-failure/domain-failure.js';

function isHttpOrHttpsProtocol(value: string): boolean {
  return Result.fromThrowable(() => new URL(value))
    .map((url) => url.protocol)
    .map((protocol) => protocol === 'http:' || protocol === 'https:')
    .unwrapOr(false);
}

export type Url = Brand<string, 'Url'>;

export namespace Url {
  export const $ = z.string().url().refine(isHttpOrHttpsProtocol);

  export function create(input: string): Result<Url, DomainFailure> {
    return Result.fromThrowable<string, ZodError>(() => $.parse(input))
      .mapErr((error) =>
        DomainFailure.validation(input, error).context('Creating Url'),
      )
      .map((value) => from(value));
  }

  export function from(value: string): Url {
    return value as Url;
  }
}

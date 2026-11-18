import { z, ZodError } from 'zod';
import { Result, Option } from '@wish-list/common-result';
import { Email } from '../email/email.js';
import { DomainFailure } from '../domain-failure/domain-failure.js';

/**
 * Who the identity broker says the caller is (ADR-0038). Broker-agnostic:
 * claim names and the provider allowlist belong to the lib reading the token.
 * `name` is what the broker reported, absent when it reported none (ADR-0040).
 */
export interface Identity {
  readonly providerId: string;
  readonly provider: string;
  readonly email: Email;
  readonly name: Option<string>;
}

export namespace Identity {
  export const $ = z.object({
    providerId: z.string().min(1),
    provider: z.string().min(1),
    email: Email.$,
  });

  export interface CreateInput {
    readonly providerId: string;
    readonly provider: string;
    readonly email: string;
    readonly name: Option<string>;
  }

  export function create(input: CreateInput): Result<Identity, DomainFailure> {
    return Result.fromThrowable<z.infer<typeof $>, ZodError>(() =>
      $.parse({
        providerId: input.providerId,
        provider: input.provider,
        email: input.email,
      }),
    )
      .mapErr((error) =>
        DomainFailure.validation(input, error).context('Creating Identity'),
      )
      .map((value) => ({
        providerId: value.providerId,
        provider: value.provider,
        email: Email.from(value.email),
        name: input.name
          .map((name) => name.trim())
          .filter((name) => name.length > 0),
      }));
  }
}

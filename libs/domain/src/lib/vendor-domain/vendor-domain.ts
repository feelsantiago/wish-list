import { z, ZodError } from 'zod';
import {
  createRegExp,
  exactly,
  maybe,
  oneOrMore,
  anyOf,
  letter,
  digit,
} from 'magic-regexp';
import { Result } from '@wish-list/common-result';
import type { Brand } from '../brand/brand.js';
import { DomainFailure } from '../domain-failure/domain-failure.js';

const alnum = anyOf(letter, digit);
const alnumOrHyphen = alnum.or(exactly('-'));
const label = exactly(alnum, maybe(alnumOrHyphen.times.between(0, 61), alnum));

const HOSTNAME_PATTERN = createRegExp(
  oneOrMore(label, exactly('.'))
    .at.lineStart()
    .and(letter.times.atLeast(2))
    .at.lineEnd(),
);

export type VendorDomain = Brand<string, 'VendorDomain'>;

export namespace VendorDomain {
  export const $ = z
    .string()
    .regex(HOSTNAME_PATTERN)
    .transform((v) => v.toLowerCase());

  export function create(input: string): Result<VendorDomain, DomainFailure> {
    return Result.fromThrowable<string, ZodError>(() => $.parse(input))
      .mapErr((error) =>
        DomainFailure.validation(input, error).context(
          'Creating VendorDomain',
        ),
      )
      .map((value) => from(value));
  }

  export function from(value: string): VendorDomain {
    return value as VendorDomain;
  }
}

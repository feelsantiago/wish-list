import { Failure } from '@wish-list/common-error';
import type { DomainFailure } from '@wish-list/domain';

/**
 * Every reason a complete reading can fail to become domain data.
 * Assignable to {@link ReadingFailure} so callers need no mapping.
 */
export type CompleteProductReadingFailure = Failure<
  'unsupported-currency' | 'no-data'
>;

export namespace CompleteProductReadingFailure {
  export function unsupportedCurrency(
    value: string,
    cause: DomainFailure,
  ): CompleteProductReadingFailure {
    return Failure.create(
      'unsupported-currency',
      `Unsupported currency: ${value}`,
      { cause },
    );
  }

  export function invalidPrice(
    cause: DomainFailure,
  ): CompleteProductReadingFailure {
    return Failure.create('no-data', 'Invalid price', { cause });
  }

  export function unresolvableImage(
    image: string,
  ): CompleteProductReadingFailure {
    return Failure.create('no-data', `Could not resolve image URL: ${image}`);
  }

  export function invalidImageUrl(
    cause: DomainFailure,
  ): CompleteProductReadingFailure {
    return Failure.create('no-data', 'Resolved image URL is invalid', {
      cause,
    });
  }
}

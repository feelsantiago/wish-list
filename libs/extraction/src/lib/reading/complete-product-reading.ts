import { Result } from '@wish-list/common-result';
import { Failure } from '@wish-list/common-error';
import { UrlMetadata } from '@wish-list/common-utils';
import { Currency, Item, Money, Url, Vendor } from '@wish-list/domain';

export interface CompleteProductReading {
  readonly name: string;
  readonly price: number;
  readonly currency: string;
  readonly image: string;
  readonly vendorName: string;
}

export type CompleteProductReadingFailure = Failure<
  'unsupported-currency' | 'no-data'
>;

export namespace CompleteProductReading {
  export function toDomain(
    reading: CompleteProductReading,
    url: Url,
  ): Result<
    { item: Item.ExtractionData; vendor: Vendor.ExtractionData },
    CompleteProductReadingFailure
  > {
    return Result.safeTry(function* () {
      const currency = yield* parseCurrency(reading.currency);
      const image = yield* resolveImage(reading.image, url);
      const price = yield* Money.create(reading.price, currency).mapErr(
        (error) => Failure.create('no-data', 'Invalid price', { cause: error }),
      );
      const website = Url.from(UrlMetadata.from(url).origin());

      return Result.ok({
        item: { name: reading.name, price, image },
        vendor: {
          name: reading.vendorName,
          website: website,
          currency,
        },
      });
    });
  }

  function parseCurrency(
    value: string,
  ): Result<Currency, CompleteProductReadingFailure> {
    return Currency.create(value).mapErr((error) =>
      Failure.create('unsupported-currency', `Unsupported currency: ${value}`, {
        cause: error,
      }),
    );
  }

  function resolveImage(
    image: string,
    pageUrl: Url,
  ): Result<Url, CompleteProductReadingFailure> {
    return Result.fromThrowable(
      () => new URL(image, pageUrl).toString(),
      () => Failure.create('no-data', `Could not resolve image URL: ${image}`),
    ).andThen((resolved) =>
      Url.create(resolved).mapErr((error) =>
        Failure.create('no-data', 'Resolved image URL is invalid', {
          cause: error,
        }),
      ),
    );
  }
}

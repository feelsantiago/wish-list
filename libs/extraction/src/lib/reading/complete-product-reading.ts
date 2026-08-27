import { Result } from '@wish-list/common-result';
import { UrlMetadata } from '@wish-list/common-utils';
import { Currency, Item, Money, Url, Vendor } from '@wish-list/domain';
import { CompleteProductReadingFailure } from './complete-product-reading-failure.js';

export interface CompleteProductReading {
  readonly name: string;
  readonly price: number;
  readonly currency: string;
  readonly image: string;
  readonly vendorName: string;
}

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
        CompleteProductReadingFailure.invalidPrice,
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
      CompleteProductReadingFailure.unsupportedCurrency(value, error),
    );
  }

  function resolveImage(
    image: string,
    pageUrl: Url,
  ): Result<Url, CompleteProductReadingFailure> {
    return Result.fromThrowable(
      () => new URL(image, pageUrl).toString(),
      () => CompleteProductReadingFailure.unresolvableImage(image),
    ).andThen((resolved) =>
      Url.create(resolved).mapErr(
        CompleteProductReadingFailure.invalidImageUrl,
      ),
    );
  }
}

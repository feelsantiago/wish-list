import { Option, Result } from '@wish-list/common-result';
import { Failure } from '@wish-list/common-error';
import { Currency, Item, Money, Url, Vendor } from '@wish-list/domain';

export interface ProductReading {
  readonly name: Option<string>;
  readonly price: Option<number>;
  readonly currency: Option<string>;
  readonly image: Option<string>;
  readonly vendorName: Option<string>;
}

export interface CompleteProductReading {
  readonly name: string;
  readonly price: number;
  readonly currency: string;
  readonly image: string;
  readonly vendorName: string;
}

export namespace ProductReading {
  export const EMPTY: ProductReading = {
    name: Option.none(),
    price: Option.none(),
    currency: Option.none(),
    image: Option.none(),
    vendorName: Option.none(),
  };

  export function complete(
    reading: ProductReading,
  ): Option<CompleteProductReading> {
    if (
      reading.name.isSome() &&
      reading.price.isSome() &&
      reading.currency.isSome() &&
      reading.image.isSome() &&
      reading.vendorName.isSome()
    ) {
      return Option.some({
        name: reading.name.value,
        price: reading.price.value,
        currency: reading.currency.value,
        image: reading.image.value,
        vendorName: reading.vendorName.value,
      });
    }

    return Option.none();
  }
}

type ToDomainFailure = Failure<'unsupported-currency' | 'no-data'>;

function parseCurrency(value: string): Result<Currency, ToDomainFailure> {
  const parsed = Currency.$.safeParse(value);

  return parsed.success
    ? Result.ok(parsed.data)
    : Result.err(
        Failure.create(
          'unsupported-currency',
          `Unsupported currency: ${value}`,
        ),
      );
}

function resolveImage(image: string, pageUrl: Url): Result<Url, ToDomainFailure> {
  return Result.fromThrowable(
    () => new URL(image, pageUrl).toString(),
    () => Failure.create('no-data', `Could not resolve image URL: ${image}`),
  ).andThen((resolved) =>
    Url.create(resolved).mapErr((error) =>
      Failure.create('no-data', 'Resolved image URL is invalid', { cause: error }),
    ),
  );
}

function websiteOf(pageUrl: Url): Url {
  return Url.from(new URL(pageUrl).origin);
}

export namespace CompleteProductReading {
  export function toDomain(
    reading: CompleteProductReading,
    url: Url,
  ): Result<
    { item: Item.ExtractionData; vendor: Vendor.ExtractionData },
    ToDomainFailure
  > {
    return parseCurrency(reading.currency).andThen((currency) =>
      resolveImage(reading.image, url).andThen((image) =>
        Money.create(reading.price, currency)
          .mapErr((error) =>
            Failure.create('no-data', 'Invalid price', { cause: error }),
          )
          .map((price) => ({
            item: { name: reading.name, price, image },
            vendor: {
              name: reading.vendorName,
              website: websiteOf(url),
              currency,
            },
          })),
      ),
    );
  }
}

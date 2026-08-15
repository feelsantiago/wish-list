import { Option } from '@wish-list/common-result';

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

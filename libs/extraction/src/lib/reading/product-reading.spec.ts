import { describe, it, expect } from 'vitest';
import { Option } from '@wish-list/common-result';
import { ProductReading } from './product-reading.js';

const FULL = {
  name: Option.some('Trail Runner 3'),
  price: Option.some(129.99),
  currency: Option.some('USD'),
  image: Option.some('https://cdn.acme.example/trail-runner-3.jpg'),
  vendorName: Option.some('Acme Outfitters'),
};

describe('ProductReading.complete', () => {
  it('returns Some when all five fields are present', () => {
    expect(ProductReading.complete(FULL)).toEqual(
      Option.some({
        name: 'Trail Runner 3',
        price: 129.99,
        currency: 'USD',
        image: 'https://cdn.acme.example/trail-runner-3.jpg',
        vendorName: 'Acme Outfitters',
      }),
    );
  });

  it('returns None when EMPTY', () => {
    expect(ProductReading.complete(ProductReading.EMPTY)).toEqual(
      Option.none(),
    );
  });

  const fields = ['name', 'price', 'currency', 'image', 'vendorName'] as const;

  for (const field of fields) {
    it(`returns None when only ${field} is missing`, () => {
      const reading = { ...FULL, [field]: Option.none() };

      expect(ProductReading.complete(reading)).toEqual(Option.none());
    });
  }
});

import { describe, it, expect } from 'vitest';
import { Option } from '@wish-list/common-result';
import { Url } from '@wish-list/domain';
import { CompleteProductReading, ProductReading } from './product-reading.js';

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

describe('CompleteProductReading.toDomain', () => {
  const pageUrl = Url.from('https://acme.example/products/trail-runner-3');

  const reading: CompleteProductReading = {
    name: 'Trail Runner 3',
    price: 129.99,
    currency: 'USD',
    image: '/img/trail-runner-3.jpg',
    vendorName: 'Acme Outfitters',
  };

  it('resolves a relative image URL against the page URL and derives the vendor website', () => {
    const result = CompleteProductReading.toDomain(reading, pageUrl);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;

    expect(result.value.item).toEqual({
      name: 'Trail Runner 3',
      price: { amount: 129.99, currency: 'USD' },
      image: 'https://acme.example/img/trail-runner-3.jpg',
    });
    expect(result.value.vendor).toEqual({
      name: 'Acme Outfitters',
      website: 'https://acme.example',
      currency: 'USD',
    });
  });

  it('fails as unsupported-currency for a currency outside USD/BRL', () => {
    const result = CompleteProductReading.toDomain(
      { ...reading, currency: 'EUR' },
      pageUrl,
    );

    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe('unsupported-currency');
  });

  it('fails as no-data for a negative price', () => {
    const result = CompleteProductReading.toDomain(
      { ...reading, price: -5 },
      pageUrl,
    );

    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe('no-data');
  });
});

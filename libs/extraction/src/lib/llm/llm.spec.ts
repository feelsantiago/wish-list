import { describe, it, expect } from 'vitest';
import { Option } from '@wish-list/common-result';
import { Llm } from './llm.js';

describe('Llm.product$', () => {
  it('reads a full reply', () => {
    expect(
      Llm.product$.parse({
        name: 'Trail Runner 3',
        price: 129.99,
        currency: 'USD',
        image: 'https://cdn.acme.example/trail-runner-3.jpg',
        vendorName: 'Acme Outfitters',
      }),
    ).toEqual({
      name: Option.some('Trail Runner 3'),
      price: Option.some(129.99),
      currency: Option.some('USD'),
      image: Option.some('https://cdn.acme.example/trail-runner-3.jpg'),
      vendorName: Option.some('Acme Outfitters'),
    });
  });

  it('parses a string price', () => {
    expect(Llm.product$.parse({ price: '129.99' }).price).toEqual(
      Option.some(129.99),
    );
  });

  it('rejects an unparseable string price as None', () => {
    expect(Llm.product$.parse({ price: 'on request' }).price).toEqual(
      Option.none(),
    );
  });

  it('maps absent fields to None', () => {
    expect(Llm.product$.parse({})).toEqual({
      name: Option.none(),
      price: Option.none(),
      currency: Option.none(),
      image: Option.none(),
      vendorName: Option.none(),
    });
  });

  it('ignores unknown keys', () => {
    expect(
      Llm.product$.parse({ name: 'Trail Runner 3', sku: 'TR3-42' }).name,
    ).toEqual(Option.some('Trail Runner 3'));
  });

  it('keeps an unsupported currency verbatim rather than coercing it', () => {
    expect(Llm.product$.parse({ currency: 'ZWL' }).currency).toEqual(
      Option.some('ZWL'),
    );
  });
});

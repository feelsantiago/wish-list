import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { Option } from '@wish-list/common-result';
import { HtmlDocument } from '../html/html-document.js';
import { JsonLdStructuredParser } from './json-ld.structured-parser.js';

function fixture(name: string): HtmlDocument {
  const path = fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url));
  return HtmlDocument.parse(readFileSync(path, 'utf-8'));
}

describe('JsonLdStructuredParser', () => {
  const parser = new JsonLdStructuredParser();

  it('has source json-ld', () => {
    expect(parser.source).toBe('json-ld');
  });

  it('reads name, image, price, currency, and brand from a single Offer', () => {
    const result = parser.parse(fixture('json-ld-single-offer.html'));

    expect(result).toEqual(
      Option.some({
        name: Option.some('Trail Runner 3'),
        image: Option.some('https://cdn.acme.example/trail-runner-3.jpg'),
        price: Option.some(129.99),
        currency: Option.some('USD'),
        vendorName: Option.some('Acme Outfitters'),
      }),
    );
  });

  it('walks @graph, an offers array, a string brand, and an image array', () => {
    const result = parser.parse(fixture('json-ld-graph-array-offers.html'));

    expect(result).toEqual(
      Option.some({
        name: Option.some('Ceramic Mug Set'),
        image: Option.some('https://cdn.northline.example/mug-1.jpg'),
        price: Option.some(34.5),
        currency: Option.some('BRL'),
        vendorName: Option.some('Northline Home'),
      }),
    );
  });

  it('reads price from an AggregateOffer lowPrice and an ImageObject url', () => {
    const result = parser.parse(fixture('json-ld-aggregate-offer.html'));

    expect(result).toEqual(
      Option.some({
        name: Option.some('Standing Desk'),
        image: Option.some('https://cdn.northline.example/desk.jpg'),
        price: Option.some(249),
        currency: Option.some('USD'),
        vendorName: Option.none(),
      }),
    );
  });

  it('skips a malformed block and still reads a valid sibling block', () => {
    const result = parser.parse(fixture('json-ld-malformed.html'));

    expect(result).toEqual(
      Option.some({
        name: Option.some('Spare Parts Kit'),
        image: Option.some('https://cdn.acme.example/spare-parts-kit.jpg'),
        price: Option.some(19.99),
        currency: Option.some('USD'),
        vendorName: Option.some('Acme Outfitters'),
      }),
    );
  });

  it('returns None when no node is a Product', () => {
    expect(parser.parse(fixture('json-ld-no-product.html'))).toEqual(
      Option.none(),
    );
  });

  it('returns None when there is no JSON-LD at all', () => {
    expect(
      parser.parse(HtmlDocument.parse('<html><body>plain page</body></html>')),
    ).toEqual(Option.none());
  });

  it('picks the most complete Product node, not the first in document order', () => {
    const result = parser.parse(fixture('json-ld-carousel.html'));

    expect(result).toEqual(
      Option.some({
        name: Option.some('Trail Runner 3'),
        image: Option.some('https://cdn.acme.example/trail-runner-3.jpg'),
        price: Option.some(129.99),
        currency: Option.some('USD'),
        vendorName: Option.some('Acme Outfitters'),
      }),
    );
  });
});

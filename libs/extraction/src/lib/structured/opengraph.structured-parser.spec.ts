import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { Option } from '@wish-list/common-result';
import { HtmlDocument } from '../html/html-document.js';
import { OpenGraphStructuredParser } from './opengraph.structured-parser.js';

function fixture(name: string): HtmlDocument {
  const path = fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url));
  return HtmlDocument.parse(readFileSync(path, 'utf-8'));
}

describe('OpenGraphStructuredParser', () => {
  const parser = new OpenGraphStructuredParser();

  it('has source opengraph', () => {
    expect(parser.source).toBe('opengraph');
  });

  it('reads title, image, site name, and product price/currency', () => {
    const result = parser.parse(fixture('opengraph-full.html'));

    expect(result).toEqual(
      Option.some({
        name: Option.some('Trail Runner 3'),
        image: Option.some('https://cdn.acme.example/trail-runner-3.jpg'),
        vendorName: Option.some('Acme Outfitters'),
        price: Option.some(129.99),
        currency: Option.some('USD'),
      }),
    );
  });

  it('falls back to twitter:title/twitter:image when og tags are absent', () => {
    const result = parser.parse(fixture('opengraph-twitter-fallback.html'));

    expect(result).toEqual(
      Option.some({
        name: Option.some('Ceramic Mug Set'),
        image: Option.some('https://cdn.northline.example/mug-1.jpg'),
        vendorName: Option.none(),
        price: Option.none(),
        currency: Option.none(),
      }),
    );
  });

  it('returns None when no relevant meta tags are present', () => {
    expect(parser.parse(fixture('opengraph-empty.html'))).toEqual(
      Option.none(),
    );
  });
});

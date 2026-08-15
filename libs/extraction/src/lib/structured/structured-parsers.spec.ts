import { describe, it, expect, vi } from 'vitest';
import { Option } from '@wish-list/common-result';
import { HtmlDocument } from '../html/html-document.js';
import { ProductReading } from '../reading/product-reading.js';
import { StructuredParsers } from './structured-parsers.js';
import type { StructuredParser } from './structured-parser.js';

const READING_A: ProductReading = { ...ProductReading.EMPTY, name: Option.some('A') };
const READING_B: ProductReading = { ...ProductReading.EMPTY, name: Option.some('B') };

function stubParser(
  source: StructuredParser['source'],
  reading: Option<ProductReading>,
): StructuredParser {
  return { source, parse: vi.fn(() => reading) };
}

describe('StructuredParsers', () => {
  const doc = HtmlDocument.parse('<html></html>');

  it('yields a candidate for each parser with a present reading, in order', () => {
    const jsonLd = stubParser('json-ld', Option.some(READING_A));
    const opengraph = stubParser('opengraph', Option.some(READING_B));
    const parsers = new StructuredParsers([jsonLd, opengraph]);

    expect([...parsers.parse(doc)]).toEqual([
      { source: 'json-ld', reading: READING_A },
      { source: 'opengraph', reading: READING_B },
    ]);
  });

  it('skips a parser whose reading is None', () => {
    const jsonLd = stubParser('json-ld', Option.none());
    const opengraph = stubParser('opengraph', Option.some(READING_B));
    const parsers = new StructuredParsers([jsonLd, opengraph]);

    expect([...parsers.parse(doc)]).toEqual([
      { source: 'opengraph', reading: READING_B },
    ]);
  });

  it('yields nothing when every parser reads None', () => {
    const jsonLd = stubParser('json-ld', Option.none());
    const opengraph = stubParser('opengraph', Option.none());
    const parsers = new StructuredParsers([jsonLd, opengraph]);

    expect([...parsers.parse(doc)]).toEqual([]);
  });

  it('does not call a later parser once the consumer stops after an earlier candidate', () => {
    const jsonLd = stubParser('json-ld', Option.some(READING_A));
    const opengraph: StructuredParser = { source: 'opengraph', parse: vi.fn() };
    const parsers = new StructuredParsers([jsonLd, opengraph]);

    for (const candidate of parsers.parse(doc)) {
      expect(candidate.source).toBe('json-ld');
      break;
    }

    expect(opengraph.parse).not.toHaveBeenCalled();
  });
});

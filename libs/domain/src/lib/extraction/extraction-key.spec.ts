import { Url } from '../url/url.js';
import { ExtractionKey } from './extraction-key.js';

function key(url: string): string {
  return ExtractionKey.fromUrl(Url.from(url));
}

describe('ExtractionKey.fromUrl normalization', () => {
  it.each([
    [
      'lowercases scheme and host, preserves path case',
      'HTTPS://Amazon.COM/dp/B0XYZ',
      'https://amazon.com/dp/B0XYZ',
    ],
    [
      'drops a leading www.',
      'https://www.amazon.com/dp/B0XYZ',
      'https://amazon.com/dp/B0XYZ',
    ],
    [
      'forces https',
      'http://amazon.com/dp/B0XYZ',
      'https://amazon.com/dp/B0XYZ',
    ],
    [
      'drops the fragment',
      'https://amazon.com/dp/B0XYZ#reviews',
      'https://amazon.com/dp/B0XYZ',
    ],
    [
      'strips a trailing slash from the path',
      'https://amazon.com/dp/B0XYZ/',
      'https://amazon.com/dp/B0XYZ',
    ],
    ['keeps the root path as /', 'https://amazon.com/', 'https://amazon.com/'],
    [
      'drops utm_* tracking params',
      'https://amazon.com/dp/B0XYZ?utm_source=newsletter&utm_medium=email',
      'https://amazon.com/dp/B0XYZ',
    ],
    [
      'drops tag',
      'https://amazon.com/dp/B0XYZ?tag=aff-20',
      'https://amazon.com/dp/B0XYZ',
    ],
    [
      'drops ref',
      'https://amazon.com/dp/B0XYZ?ref=sr_1_1',
      'https://amazon.com/dp/B0XYZ',
    ],
    [
      'drops ref_* params',
      'https://amazon.com/dp/B0XYZ?ref_=sr_1_1',
      'https://amazon.com/dp/B0XYZ',
    ],
    [
      'drops gclid',
      'https://amazon.com/dp/B0XYZ?gclid=abc123',
      'https://amazon.com/dp/B0XYZ',
    ],
    [
      'drops fbclid',
      'https://amazon.com/dp/B0XYZ?fbclid=abc123',
      'https://amazon.com/dp/B0XYZ',
    ],
    [
      'drops mc_* params',
      'https://amazon.com/dp/B0XYZ?mc_eid=abc123',
      'https://amazon.com/dp/B0XYZ',
    ],
    [
      'drops _encoding',
      'https://amazon.com/dp/B0XYZ?_encoding=UTF8',
      'https://amazon.com/dp/B0XYZ',
    ],
    [
      'drops psc',
      'https://amazon.com/dp/B0XYZ?psc=1',
      'https://amazon.com/dp/B0XYZ',
    ],
    [
      'drops th',
      'https://amazon.com/dp/B0XYZ?th=1',
      'https://amazon.com/dp/B0XYZ',
    ],
    [
      'keeps product-identifying params, sorted by name',
      'https://example.com/product?size=large&color=blue',
      'https://example.com/product?color=blue&size=large',
    ],
    [
      'mixes tracking and product params correctly',
      'https://amazon.com/dp/B0XYZ?tag=aff-20&th=1&variant=red',
      'https://amazon.com/dp/B0XYZ?variant=red',
    ],
  ])('%s', (_description, input, expected) => {
    expect(key(input)).toBe(expected);
  });

  it('produces the same key for equivalent URLs', () => {
    const a = key('https://www.amazon.com/dp/B0XYZ?tag=aff-20');
    const b = key('http://amazon.com/dp/B0XYZ#section');
    expect(a).toBe(b);
  });
});

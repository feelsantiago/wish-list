import { UrlMetadata } from './url-metadata.js';
import { UnFilteredParams, type UrlParamsFilter } from './url-params-filter.js';
import { SortByNameAscending, UnsortedParams } from './url-params-sort.js';

describe('UrlMetadata.host', () => {
  it('returns the lowercased hostname', () => {
    expect(UrlMetadata.from('https://Www.Amazon.COM/dp/123').host()).toBe(
      'www.amazon.com',
    );
  });
});

describe('UrlMetadata.origin', () => {
  it('drops the path, query and hash', () => {
    expect(
      UrlMetadata.from(
        'https://acme.example/dp/123?tag=aff-20#reviews',
      ).origin(),
    ).toBe('https://acme.example');
  });

  it('keeps a non-default port', () => {
    expect(UrlMetadata.from('http://localhost:3000/products').origin()).toBe(
      'http://localhost:3000',
    );
  });
});

describe('UrlMetadata.path', () => {
  it('strips a trailing slash', () => {
    expect(UrlMetadata.from('https://amazon.com/dp/123/').path()).toBe(
      '/dp/123',
    );
  });

  it('keeps the root path as /', () => {
    expect(UrlMetadata.from('https://amazon.com/').path()).toBe('/');
  });

  it('returns / for a URL with no path', () => {
    expect(UrlMetadata.from('https://amazon.com').path()).toBe('/');
  });
});

describe('UrlMetadata.domain', () => {
  it('resolves the registrable domain from a subdomain', () => {
    const domain = UrlMetadata.from('https://www.amazon.com/dp/123').domain();
    expect(domain.isSome()).toBe(true);
    expect(domain.unwrapOr('')).toBe('amazon.com');
  });

  it('resolves a multi-part public suffix to its eTLD+1', () => {
    const domain = UrlMetadata.from('https://www.amazon.com.br').domain();
    expect(domain.unwrapOr('')).toBe('amazon.com.br');
  });

  it('returns None when no registrable domain is resolvable', () => {
    const domain = UrlMetadata.from('https://localhost').domain();
    expect(domain.isNone()).toBe(true);
  });
});

const excludeTag: UrlParamsFilter = {
  include: (param) => param !== 'tag',
};

describe('UrlMetadata.params', () => {
  it('returns entries in insertion order by default', () => {
    const params = UrlMetadata.from(
      'https://example.com/product?size=large&color=blue',
    ).params();
    expect(params).toEqual([
      ['size', 'large'],
      ['color', 'blue'],
    ]);
  });

  it('defaults to UnFilteredParams, keeping every param', () => {
    const params = UrlMetadata.from(
      'https://amazon.com/dp/123?tag=aff-20&variant=red',
      {
        filter: new UnFilteredParams(),
      },
    ).params();
    expect(params).toEqual([
      ['tag', 'aff-20'],
      ['variant', 'red'],
    ]);
  });

  it('defaults to UnsortedParams, preserving insertion order', () => {
    const params = UrlMetadata.from(
      'https://example.com/product?size=large&color=blue',
      {
        sort: new UnsortedParams(),
      },
    ).params();
    expect(params).toEqual([
      ['size', 'large'],
      ['color', 'blue'],
    ]);
  });

  it('excludes names case-insensitively via the given filter', () => {
    const params = UrlMetadata.from(
      'https://amazon.com/dp/123?TAG=aff-20&variant=red',
      {
        filter: excludeTag,
      },
    ).params();
    expect(params).toEqual([['variant', 'red']]);
  });

  it('sorts by name ascending when given SortByNameAscending', () => {
    const params = UrlMetadata.from(
      'https://example.com/product?size=large&color=blue',
      {
        sort: new SortByNameAscending(),
      },
    ).params();
    expect(params).toEqual([
      ['color', 'blue'],
      ['size', 'large'],
    ]);
  });

  it('returns an empty array when there are no query params', () => {
    expect(UrlMetadata.from('https://amazon.com/dp/123').params()).toEqual([]);
  });
});

describe('UrlMetadata.query', () => {
  it('builds a query string from the filtered, sorted params', () => {
    const query = UrlMetadata.from(
      'https://amazon.com/dp/123?tag=aff-20&variant=red',
      {
        filter: excludeTag,
        sort: new SortByNameAscending(),
      },
    ).query();
    expect(query).toBe('?variant=red');
  });

  it('returns an empty string when no params remain', () => {
    const query = UrlMetadata.from('https://amazon.com/dp/123?tag=aff-20', {
      filter: excludeTag,
    }).query();
    expect(query).toBe('');
  });
});

import { Id } from '../id/id.js';
import { Money } from '../money/money.js';
import { Url } from '../url/url.js';
import { ExtractionKey } from './extraction-key.js';
import { Extraction } from './extraction.js';

function money(): Money {
  const result = Money.create(19.99, 'USD');
  if (result.isErr()) throw new Error('unreachable');
  return result.value;
}

function succeededInput(): Extraction.SucceededInput {
  return {
    url: Url.from('https://amazon.com/dp/B0XYZ'),
    vendor: Id.generate(),
    source: 'json-ld',
    data: {
      name: 'Widget',
      price: money(),
      image: Url.from('https://amazon.com/img.png'),
    },
    vendorData: {
      name: 'Amazon',
      website: Url.from('https://amazon.com'),
      currency: 'USD',
    },
  };
}

describe('Extraction.succeeded', () => {
  it('builds a SucceededExtraction with a derived key', () => {
    const extraction = Extraction.succeeded(succeededInput());
    expect(extraction._tag).toBe('succeeded');
    expect(extraction.id).toBeTruthy();
    expect(extraction.key).toBe(ExtractionKey.fromUrl(succeededInput().url));
    expect(extraction.source).toBe('json-ld');
    expect(extraction.data.name).toBe('Widget');
    expect(extraction.vendorData.name).toBe('Amazon');
  });
});

describe('Extraction.failed', () => {
  it('builds a FailedExtraction with a derived key and the given reason', () => {
    const extraction = Extraction.failed({
      url: Url.from('https://amazon.com/dp/B0XYZ'),
      vendor: Id.generate(),
      reason: 'blocked',
    });
    expect(extraction._tag).toBe('failed');
    expect(extraction.reason).toBe('blocked');
    expect(extraction.key).toBe(
      ExtractionKey.fromUrl(Url.from('https://amazon.com/dp/B0XYZ')),
    );
  });
});

describe('Extraction type guards', () => {
  it('isSucceeded/isFailed narrow correctly', () => {
    const succeeded = Extraction.succeeded(succeededInput());
    const failed = Extraction.failed({
      url: Url.from('https://amazon.com/dp/B0XYZ'),
      vendor: Id.generate(),
      reason: 'timeout',
    });

    expect(Extraction.isSucceeded(succeeded)).toBe(true);
    expect(Extraction.isFailed(succeeded)).toBe(false);
    expect(Extraction.isFailed(failed)).toBe(true);
    expect(Extraction.isSucceeded(failed)).toBe(false);
  });
});

describe('Extraction round-trip', () => {
  it('deep-equals the original SucceededExtraction', () => {
    const succeeded = Extraction.succeeded(succeededInput());
    expect(Extraction.from(Extraction.plain(succeeded))).toEqual(succeeded);
  });

  it('deep-equals the original FailedExtraction', () => {
    const failed = Extraction.failed({
      url: Url.from('https://amazon.com/dp/B0XYZ'),
      vendor: Id.generate(),
      reason: 'unsupported-currency',
    });
    expect(Extraction.from(Extraction.plain(failed))).toEqual(failed);
  });
});

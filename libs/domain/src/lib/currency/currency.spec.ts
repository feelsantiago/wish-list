import { Failure } from '@wish-list/common-error';
import { Currency } from './currency.js';

describe('Currency.$', () => {
  it('accepts USD', () => {
    expect(Currency.$.safeParse('USD').success).toBe(true);
  });

  it('accepts BRL', () => {
    expect(Currency.$.safeParse('BRL').success).toBe(true);
  });

  it('rejects values outside the union', () => {
    expect(Currency.$.safeParse('EUR').success).toBe(false);
  });
});

describe('Currency.create', () => {
  it('returns the currency for a supported code', () => {
    const result = Currency.create('USD');
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value).toBe('USD');
  });

  it('rejects an unsupported code', () => {
    const result = Currency.create('EUR');
    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe('validation');
    expect(result.error.message).toBe('Creating Currency');

    const source = result.error.source;
    expect(source).toBeInstanceOf(Failure);
    if (!(source instanceof Failure)) return;
    expect(source.metadata['input']).toBe('EUR');
  });
});

describe('Currency.matching', () => {
  it('accepts the exact given currency', () => {
    expect(Currency.matching('USD').safeParse('USD').success).toBe(true);
  });

  it('rejects a different currency', () => {
    expect(Currency.matching('USD').safeParse('BRL').success).toBe(false);
  });
});

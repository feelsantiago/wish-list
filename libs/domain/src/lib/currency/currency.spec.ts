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

describe('Currency.matching', () => {
  it('accepts the exact given currency', () => {
    expect(Currency.matching('USD').safeParse('USD').success).toBe(true);
  });

  it('rejects a different currency', () => {
    expect(Currency.matching('USD').safeParse('BRL').success).toBe(false);
  });
});

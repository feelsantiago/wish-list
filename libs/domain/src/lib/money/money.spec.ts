import { Money } from './money.js';

describe('Money.create', () => {
  it('accepts a positive finite amount with a valid currency', () => {
    const result = Money.create(19.99, 'USD');
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.amount).toBe(19.99);
    expect(result.value.currency).toBe('USD');
  });

  it('accepts zero', () => {
    const result = Money.create(0, 'USD');
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.amount).toBe(0);
  });

  it('rejects a negative amount', () => {
    const result = Money.create(-5, 'USD');
    expect(result.isErr()).toBe(true);
  });

  it('rejects NaN', () => {
    const result = Money.create(NaN, 'USD');
    expect(result.isErr()).toBe(true);
  });

  it('rejects Infinity', () => {
    const result = Money.create(Infinity, 'USD');
    expect(result.isErr()).toBe(true);
  });

  it('rejects an invalid currency', () => {
    // @ts-expect-error -- testing invalid runtime input
    const result = Money.create(10, 'EUR');
    expect(result.isErr()).toBe(true);
  });
});

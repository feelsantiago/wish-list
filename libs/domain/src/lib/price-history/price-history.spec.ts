import { Id } from '../id/id.js';
import { Money } from '../money/money.js';
import { PriceHistory } from './price-history.js';

describe('PriceHistory.create', () => {
  it('generates id, stamps fetchedAt, carries item/price through unchanged', () => {
    const item = Id.generate();
    const priceResult = Money.create(100, 'USD');
    expect(priceResult.isOk()).toBe(true);
    if (priceResult.isErr()) return;
    const price = priceResult.value;

    const priceHistory = PriceHistory.create({ item, price });
    expect(priceHistory.id).toBeTruthy();
    expect(priceHistory.item).toBe(item);
    expect(priceHistory.price).toBe(price);
    expect(priceHistory.fetchedAt).toBeInstanceOf(Date);
  });
});

describe('PriceHistory round-trip', () => {
  it('PriceHistory.from(PriceHistory.plain(priceHistory)) deep-equals the original', () => {
    const item = Id.generate();
    const priceResult = Money.create(100, 'USD');
    expect(priceResult.isOk()).toBe(true);
    if (priceResult.isErr()) return;
    const price = priceResult.value;

    const priceHistory = PriceHistory.create({ item, price });
    expect(PriceHistory.from(PriceHistory.plain(priceHistory))).toEqual(
      priceHistory,
    );
  });
});

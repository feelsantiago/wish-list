import type { Plain } from '../plain/plain.js';
import { Id } from '../id/id.js';
import type { Money } from '../money/money.js';

export interface PriceHistory {
  readonly id: Id;
  readonly item: Id;
  readonly price: Money;
  readonly fetchedAt: Date;
}

export namespace PriceHistory {
  export interface CreateInput {
    readonly item: Id;
    readonly price: Money;
  }

  export function create(input: CreateInput): PriceHistory {
    return {
      id: Id.generate(),
      item: input.item,
      price: input.price,
      fetchedAt: new Date(),
    };
  }

  export function from(plain: Plain<PriceHistory>): PriceHistory {
    return {
      id: plain.id as Id,
      item: plain.item as Id,
      price: plain.price,
      fetchedAt: new Date(plain.fetchedAt),
    };
  }

  export function plain(priceHistory: PriceHistory): Plain<PriceHistory> {
    return {
      id: priceHistory.id,
      item: priceHistory.item,
      price: priceHistory.price,
      fetchedAt: priceHistory.fetchedAt.toISOString(),
    };
  }
}

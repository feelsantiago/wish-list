import { expectTypeOf } from 'vitest';
import { Id } from '../id/id.js';
import { Money } from '../money/money.js';
import { Url } from '../url/url.js';
import { Item } from './item.js';
import type {
  PendingItem,
  ExtractedItem,
  FailedExtractionItem,
  WantedItem,
  FulfilledItem,
} from './item.js';

function money(): Money {
  const result = Money.create(19.99, 'USD');
  if (result.isErr()) throw new Error('unreachable');
  return result.value;
}

function pendingItem(): PendingItem {
  return Item.create({
    wishlist: Id.generate(),
    vendor: Id.generate(),
    category: Id.generate(),
    url: Url.from('https://amazon.com/dp/123'),
  });
}

describe('Item.create', () => {
  it('builds a PendingItem with status wanted and equal timestamps', () => {
    const item = Item.create({
      wishlist: Id.generate(),
      vendor: Id.generate(),
      category: Id.generate(),
      url: Url.from('https://amazon.com/dp/123'),
    });
    expect(item._tag).toBe('pending');
    expect(item.status).toBe('wanted');
    expect(item.id).toBeTruthy();
    expect(item.createdAt).toEqual(item.updatedAt);
  });
});

describe('Item.extract', () => {
  it('transitions a PendingItem to an ExtractedItem', () => {
    const pending = pendingItem();
    const result = Item.extract(pending, {
      name: 'Widget',
      price: money(),
      image: Url.from('https://amazon.com/img.png'),
    });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    const extracted = result.value;
    expect(extracted._tag).toBe('extracted');
    expect(extracted.name).toBe('Widget');
    expect(extracted.price).toEqual(money());
    expect(extracted.image).toBe(Url.from('https://amazon.com/img.png'));
    expect(extracted.updatedAt.getTime()).toBeGreaterThanOrEqual(
      pending.updatedAt.getTime(),
    );
  });

  it('rejects an empty name', () => {
    const result = Item.extract(pendingItem(), {
      name: '',
      price: money(),
      image: Url.from('https://amazon.com/img.png'),
    });
    expect(result.isErr()).toBe(true);
  });
});

describe('Item.failed', () => {
  it('produces a FailedExtractionItem with the given reason', () => {
    const pending = pendingItem();
    const failed = Item.failed(pending, 'page returned 403');
    expect(failed._tag).toBe('failed');
    expect(failed.reason).toBe('page returned 403');
    expect(failed.updatedAt.getTime()).toBeGreaterThanOrEqual(
      pending.updatedAt.getTime(),
    );
  });
});

describe('Item.retry', () => {
  it('transitions a FailedExtractionItem back to PendingItem', () => {
    const failed = Item.failed(pendingItem(), 'LLM response malformed');
    const retried = Item.retry(failed);
    expect(retried._tag).toBe('pending');
    expect('reason' in retried).toBe(false);
    expect('name' in retried).toBe(false);
    expect('price' in retried).toBe(false);
    expect('image' in retried).toBe(false);
  });
});

describe('Item.correct', () => {
  it('fills in a FailedExtractionItem', () => {
    const failed = Item.failed(pendingItem(), 'page returned 403');
    const result = Item.correct(failed, {
      name: 'Widget',
      price: money(),
      image: Url.from('https://amazon.com/img.png'),
    });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value._tag).toBe('extracted');
    expect(result.value.name).toBe('Widget');
  });

  it('overwrites an existing ExtractedItem', () => {
    const pending = pendingItem();
    const extractedResult = Item.extract(pending, {
      name: 'Old name',
      price: money(),
      image: Url.from('https://amazon.com/old.png'),
    });
    if (extractedResult.isErr()) throw new Error('unreachable');
    const result = Item.correct(extractedResult.value, {
      name: 'New name',
      price: money(),
      image: Url.from('https://amazon.com/new.png'),
    });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.name).toBe('New name');
    expect(result.value.image).toBe(Url.from('https://amazon.com/new.png'));
  });
});

describe('Item type guards', () => {
  it('isPending/isExtracted/isFailed narrow correctly', () => {
    const pending = pendingItem();
    const failed = Item.failed(pendingItem(), 'page returned 403');
    const extractedResult = Item.extract(pendingItem(), {
      name: 'Widget',
      price: money(),
      image: Url.from('https://amazon.com/img.png'),
    });
    if (extractedResult.isErr()) throw new Error('unreachable');

    expect(Item.isPending(pending)).toBe(true);
    expect(Item.isExtracted(pending)).toBe(false);
    expect(Item.isFailed(pending)).toBe(false);

    expect(Item.isFailed(failed)).toBe(true);
    expect(Item.isExtracted(extractedResult.value)).toBe(true);
  });
});

describe('Item round-trip', () => {
  it('deep-equals the original PendingItem', () => {
    const pending = pendingItem();
    expect(Item.from(Item.plain(pending))).toEqual(pending);
  });

  it('deep-equals the original ExtractedItem', () => {
    const extractedResult = Item.extract(pendingItem(), {
      name: 'Widget',
      price: money(),
      image: Url.from('https://amazon.com/img.png'),
    });
    if (extractedResult.isErr()) throw new Error('unreachable');
    const extracted = extractedResult.value;
    expect(Item.from(Item.plain(extracted))).toEqual(extracted);
  });

  it('deep-equals the original FailedExtractionItem', () => {
    const failed = Item.failed(pendingItem(), 'page returned 403');
    expect(Item.from(Item.plain(failed))).toEqual(failed);
  });
});

describe('Item status narrowing', () => {
  it('WantedItem/FulfilledItem distribute over every _tag variant', () => {
    expectTypeOf<PendingItem & { status: 'wanted' }>().toExtend<WantedItem>();
    expectTypeOf<ExtractedItem & { status: 'wanted' }>().toExtend<WantedItem>();
    expectTypeOf<
      FailedExtractionItem & { status: 'wanted' }
    >().toExtend<WantedItem>();

    expectTypeOf<
      PendingItem & { status: 'fulfilled' }
    >().toExtend<FulfilledItem>();
  });

  it('does not allow a FulfilledItem where a WantedItem is expected', () => {
    expectTypeOf<FulfilledItem>().not.toExtend<WantedItem>();
    expectTypeOf<WantedItem>().not.toExtend<FulfilledItem>();
  });
});

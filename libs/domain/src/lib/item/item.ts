import { z, ZodError } from 'zod';
import { match } from 'ts-pattern';
import { Result } from '@wish-list/common-result';
import type { Plain } from '../plain/plain.js';
import { Id } from '../id/id.js';
import { Url } from '../url/url.js';
import type { Money } from '../money/money.js';
import { DomainFailure } from '../domain-failure/domain-failure.js';

export type Status = 'wanted' | 'fulfilled';

export interface BaseItem {
  readonly id: Id;
  readonly wishlist: Id;
  readonly vendor: Id;
  readonly category: Id;
  readonly url: Url;
  readonly status: Status;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PendingItem extends BaseItem {
  readonly _tag: 'pending';
}

export interface ExtractedItem extends BaseItem {
  readonly _tag: 'extracted';
  readonly name: string;
  readonly price: Money;
  readonly image: Url;
}

export interface FailedExtractionItem extends BaseItem {
  readonly _tag: 'failed';
  readonly reason: string;
}

export type Item = PendingItem | ExtractedItem | FailedExtractionItem;

export type WantedItem = Item & { readonly status: 'wanted' };
export type FulfilledItem = Item & { readonly status: 'fulfilled' };

export namespace Item {
  const extractionData$ = z.object({
    name: z.string().min(1),
  });

  export interface CreateInput {
    readonly wishlist: Id;
    readonly vendor: Id;
    readonly category: Id;
    readonly url: Url;
  }

  export interface ExtractionData {
    readonly name: string;
    readonly price: Money;
    readonly image: Url;
  }

  export function create(input: CreateInput): PendingItem {
    const now = new Date();
    return {
      _tag: 'pending',
      id: Id.generate(),
      wishlist: input.wishlist,
      vendor: input.vendor,
      category: input.category,
      url: input.url,
      status: 'wanted',
      createdAt: now,
      updatedAt: now,
    };
  }

  export function extract(
    pending: PendingItem,
    data: ExtractionData,
  ): Result<ExtractedItem, DomainFailure> {
    return Result.fromThrowable<z.infer<typeof extractionData$>, ZodError>(() =>
      extractionData$.parse(data),
    )
      .mapErr((error) =>
        DomainFailure.validation(data, error).context('Extracting Item'),
      )
      .map((value) => ({
        ...pending,
        _tag: 'extracted',
        name: value.name,
        price: data.price,
        image: data.image,
        updatedAt: new Date(),
      }));
  }

  export function failed(
    pending: PendingItem,
    reason: string,
  ): FailedExtractionItem {
    return {
      ...pending,
      _tag: 'failed',
      reason,
      updatedAt: new Date(),
    };
  }

  export function retry(failed: FailedExtractionItem): PendingItem {
    const { reason: _reason, ...base } = failed;
    return {
      ...base,
      _tag: 'pending',
      updatedAt: new Date(),
    };
  }

  export function correct(
    item: FailedExtractionItem | ExtractedItem,
    data: ExtractionData,
  ): Result<ExtractedItem, DomainFailure> {
    return Result.fromThrowable<z.infer<typeof extractionData$>, ZodError>(() =>
      extractionData$.parse(data),
    )
      .mapErr((error) =>
        DomainFailure.validation(data, error).context('Correcting Item'),
      )
      .map((value) => ({
        id: item.id,
        wishlist: item.wishlist,
        vendor: item.vendor,
        category: item.category,
        url: item.url,
        status: item.status,
        createdAt: item.createdAt,
        _tag: 'extracted',
        name: value.name,
        price: data.price,
        image: data.image,
        updatedAt: new Date(),
      }));
  }

  export function isPending(item: Item): item is PendingItem {
    return item._tag === 'pending';
  }

  export function isExtracted(item: Item): item is ExtractedItem {
    return item._tag === 'extracted';
  }

  export function isFailed(item: Item): item is FailedExtractionItem {
    return item._tag === 'failed';
  }

  export function from(plain: Plain<Item>): Item {
    const base = {
      id: plain.id as Id,
      wishlist: plain.wishlist as Id,
      vendor: plain.vendor as Id,
      category: plain.category as Id,
      url: plain.url as Url,
      status: plain.status,
      createdAt: new Date(plain.createdAt),
      updatedAt: new Date(plain.updatedAt),
    };

    return match(plain)
      .with({ _tag: 'pending' }, () => ({ ...base, _tag: 'pending' as const }))
      .with({ _tag: 'extracted' }, (p) => ({
        ...base,
        _tag: 'extracted' as const,
        name: p.name,
        price: p.price,
        image: p.image as Url,
      }))
      .with({ _tag: 'failed' }, (p) => ({
        ...base,
        _tag: 'failed' as const,
        reason: p.reason,
      }))
      .exhaustive();
  }

  export function plain(item: Item): Plain<Item> {
    const base = {
      id: item.id,
      wishlist: item.wishlist,
      vendor: item.vendor,
      category: item.category,
      url: item.url,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };

    return match(item)
      .with({ _tag: 'pending' }, () => ({ ...base, _tag: 'pending' as const }))
      .with({ _tag: 'extracted' }, (i) => ({
        ...base,
        _tag: 'extracted' as const,
        name: i.name,
        price: i.price,
        image: i.image,
      }))
      .with({ _tag: 'failed' }, (i) => ({
        ...base,
        _tag: 'failed' as const,
        reason: i.reason,
      }))
      .exhaustive();
  }
}

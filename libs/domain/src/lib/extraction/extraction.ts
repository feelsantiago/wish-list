import { match } from 'ts-pattern';
import type { Plain } from '../plain/plain.js';
import { Id } from '../id/id.js';
import { Url } from '../url/url.js';
import type { Item } from '../item/item.js';
import type { Vendor } from '../vendor/vendor.js';
import { ExtractionKey } from './extraction-key.js';

export type ExtractionSource = 'json-ld' | 'opengraph' | 'llm';

export type ExtractionReason =
  | 'fetch-failed'
  | 'blocked'
  | 'timeout'
  | 'no-data'
  | 'unsupported-currency'
  | 'llm-failed';

interface BaseExtraction {
  readonly id: Id;
  readonly key: ExtractionKey;
  readonly url: Url;
  readonly vendor: Id;
  readonly createdAt: Date;
}

export interface SucceededExtraction extends BaseExtraction {
  readonly _tag: 'succeeded';
  readonly source: ExtractionSource;
  readonly data: Item.ExtractionData;
  readonly vendorData: Vendor.ExtractionData;
}

export interface FailedExtraction extends BaseExtraction {
  readonly _tag: 'failed';
  readonly reason: ExtractionReason;
}

export type Extraction = SucceededExtraction | FailedExtraction;

export namespace Extraction {
  export interface SucceededInput {
    readonly url: Url;
    readonly vendor: Id;
    readonly source: ExtractionSource;
    readonly data: Item.ExtractionData;
    readonly vendorData: Vendor.ExtractionData;
  }

  export interface FailedInput {
    readonly url: Url;
    readonly vendor: Id;
    readonly reason: ExtractionReason;
  }

  export function succeeded(input: SucceededInput): SucceededExtraction {
    return {
      _tag: 'succeeded',
      id: Id.generate(),
      key: ExtractionKey.fromUrl(input.url),
      url: input.url,
      vendor: input.vendor,
      source: input.source,
      data: input.data,
      vendorData: input.vendorData,
      createdAt: new Date(),
    };
  }

  export function failed(input: FailedInput): FailedExtraction {
    return {
      _tag: 'failed',
      id: Id.generate(),
      key: ExtractionKey.fromUrl(input.url),
      url: input.url,
      vendor: input.vendor,
      reason: input.reason,
      createdAt: new Date(),
    };
  }

  export function isSucceeded(
    extraction: Extraction,
  ): extraction is SucceededExtraction {
    return extraction._tag === 'succeeded';
  }

  export function isFailed(extraction: Extraction): extraction is FailedExtraction {
    return extraction._tag === 'failed';
  }

  export function from(plain: Plain<Extraction>): Extraction {
    const base = {
      id: plain.id as Id,
      key: plain.key as ExtractionKey,
      url: plain.url as Url,
      vendor: plain.vendor as Id,
      createdAt: new Date(plain.createdAt),
    };

    return match(plain)
      .with({ _tag: 'succeeded' }, (p) => ({
        ...base,
        _tag: 'succeeded' as const,
        source: p.source,
        data: {
          name: p.data.name,
          price: p.data.price,
          image: p.data.image as Url,
        },
        vendorData: {
          name: p.vendorData.name,
          website: p.vendorData.website as Url,
          currency: p.vendorData.currency,
        },
      }))
      .with({ _tag: 'failed' }, (p) => ({
        ...base,
        _tag: 'failed' as const,
        reason: p.reason,
      }))
      .exhaustive();
  }

  export function plain(extraction: Extraction): Plain<Extraction> {
    const base = {
      id: extraction.id,
      key: extraction.key,
      url: extraction.url,
      vendor: extraction.vendor,
      createdAt: extraction.createdAt.toISOString(),
    };

    return match(extraction)
      .with({ _tag: 'succeeded' }, (e) => ({
        ...base,
        _tag: 'succeeded' as const,
        source: e.source,
        data: e.data,
        vendorData: e.vendorData,
      }))
      .with({ _tag: 'failed' }, (e) => ({
        ...base,
        _tag: 'failed' as const,
        reason: e.reason,
      }))
      .exhaustive();
  }
}

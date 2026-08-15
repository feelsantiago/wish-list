import { z, ZodError } from 'zod';
import { match } from 'ts-pattern';
import { Result } from '@wish-list/common-result';
import type { Plain } from '../plain/plain.js';
import { Id } from '../id/id.js';
import { VendorDomain } from '../vendor-domain/vendor-domain.js';
import { Url } from '../url/url.js';
import { Currency } from '../currency/currency.js';
import { DomainFailure } from '../domain-failure/domain-failure.js';

interface BaseVendor {
  readonly id: Id;
  readonly vendorDomain: VendorDomain;
  readonly website: Url;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProvisionalVendor extends BaseVendor {
  readonly _tag: 'provisional';
}

export interface ResolvedVendor extends BaseVendor {
  readonly _tag: 'resolved';
  readonly name: string;
  readonly currency: Currency;
}

export type Vendor = ProvisionalVendor | ResolvedVendor;

export namespace Vendor {
  const extractionData$ = z.object({
    name: z.string().min(1),
  });

  export interface ExtractionData {
    readonly name: string;
    readonly website: Url;
    readonly currency: Currency;
  }

  export interface ProvisionalInput {
    readonly vendorDomain: VendorDomain;
    readonly website: Url;
  }

  export function provisional(input: ProvisionalInput): ProvisionalVendor {
    const now = new Date();
    return {
      _tag: 'provisional',
      id: Id.generate(),
      vendorDomain: input.vendorDomain,
      website: input.website,
      createdAt: now,
      updatedAt: now,
    };
  }

  export function resolve(
    vendor: Vendor,
    data: ExtractionData,
  ): Result<ResolvedVendor, DomainFailure> {
    return Result.fromThrowable<z.infer<typeof extractionData$>, ZodError>(() =>
      extractionData$.parse(data),
    )
      .mapErr((error) =>
        DomainFailure.validation(data, error).context('Resolving Vendor'),
      )
      .map((value) => ({
        ...vendor,
        _tag: 'resolved' as const,
        name: value.name,
        website: data.website,
        currency: data.currency,
        updatedAt: new Date(),
      }));
  }

  export function isProvisional(vendor: Vendor): vendor is ProvisionalVendor {
    return vendor._tag === 'provisional';
  }

  export function isResolved(vendor: Vendor): vendor is ResolvedVendor {
    return vendor._tag === 'resolved';
  }

  export function from(plain: Plain<Vendor>): Vendor {
    const base = {
      id: plain.id as Id,
      vendorDomain: plain.vendorDomain as VendorDomain,
      website: plain.website as Url,
      createdAt: new Date(plain.createdAt),
      updatedAt: new Date(plain.updatedAt),
    };

    return match(plain)
      .with({ _tag: 'provisional' }, () => ({
        ...base,
        _tag: 'provisional' as const,
      }))
      .with({ _tag: 'resolved' }, (p) => ({
        ...base,
        _tag: 'resolved' as const,
        name: p.name,
        currency: p.currency,
      }))
      .exhaustive();
  }

  export function plain(vendor: Vendor): Plain<Vendor> {
    const base = {
      id: vendor.id,
      vendorDomain: vendor.vendorDomain,
      website: vendor.website,
      createdAt: vendor.createdAt.toISOString(),
      updatedAt: vendor.updatedAt.toISOString(),
    };

    return match(vendor)
      .with({ _tag: 'provisional' }, () => ({
        ...base,
        _tag: 'provisional' as const,
      }))
      .with({ _tag: 'resolved' }, (v) => ({
        ...base,
        _tag: 'resolved' as const,
        name: v.name,
        currency: v.currency,
      }))
      .exhaustive();
  }
}

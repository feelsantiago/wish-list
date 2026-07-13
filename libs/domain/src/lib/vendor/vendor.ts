import { z, ZodError } from 'zod';
import { Result } from '@wish-list/common-result';
import type { Plain } from '../plain/plain.js';
import { Id } from '../id/id.js';
import { VendorDomain } from '../vendor-domain/vendor-domain.js';
import { Url } from '../url/url.js';
import { Currency } from '../currency/currency.js';
import { DomainFailure } from '../domain-failure/domain-failure.js';

export interface Vendor {
  readonly id: Id;
  readonly vendorDomain: VendorDomain;
  readonly website: Url;
  readonly name: string;
  readonly currency: Currency;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export namespace Vendor {
  export const $ = z.object({
    vendorDomain: VendorDomain.$,
    website: Url.$,
    name: z.string().min(1),
    currency: Currency.$,
  });

  export interface CreateInput {
    readonly vendorDomain: string;
    readonly website: string;
    readonly name: string;
    readonly currency: Currency;
  }

  export function create(input: CreateInput): Result<Vendor, DomainFailure> {
    return Result.fromThrowable<z.infer<typeof $>, ZodError>(() =>
      $.parse(input),
    )
      .mapErr((error) =>
        DomainFailure.validation(input, error).context('Creating Vendor'),
      )
      .map((value) => {
        const now = new Date();
        return {
          id: Id.generate(),
          vendorDomain: VendorDomain.from(value.vendorDomain),
          website: Url.from(value.website),
          name: value.name,
          currency: value.currency,
          createdAt: now,
          updatedAt: now,
        };
      });
  }

  export function from(plain: Plain<Vendor>): Vendor {
    return {
      id: plain.id as Id,
      vendorDomain: plain.vendorDomain as VendorDomain,
      website: plain.website as Url,
      name: plain.name,
      currency: plain.currency,
      createdAt: new Date(plain.createdAt),
      updatedAt: new Date(plain.updatedAt),
    };
  }

  export function plain(vendor: Vendor): Plain<Vendor> {
    return {
      id: vendor.id,
      vendorDomain: vendor.vendorDomain,
      website: vendor.website,
      name: vendor.name,
      currency: vendor.currency,
      createdAt: vendor.createdAt.toISOString(),
      updatedAt: vendor.updatedAt.toISOString(),
    };
  }
}

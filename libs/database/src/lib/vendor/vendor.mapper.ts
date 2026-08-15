import { Injectable } from '@nestjs/common';
import { match } from 'ts-pattern';
import { Vendor } from '@wish-list/domain';
import type { Currency, Id, Plain, Url, VendorDomain } from '@wish-list/domain';
import type { Result } from '@wish-list/common-result';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import type { DomainMapper } from '../mapper/domain-mapper.js';
import type { DatabaseFailure } from '../database-failure/database-failure.js';
import { vendors } from './vendor.schema.js';

export type VendorRow = typeof vendors.$inferSelect;

@Injectable()
export class VendorDatabaseDomainMapper implements DomainMapper<Vendor, VendorRow> {
  private readonly delegate: DatabaseDomainMapper<Vendor, VendorRow> =
    DatabaseDomainMapper.create(
      (vendor: Vendor) => this.toRow(vendor),
      (row: VendorRow) => Vendor.from(this.toPlainVendor(row)),
    );

  public database(entity: Vendor): VendorRow {
    return this.delegate.database(entity);
  }

  public domain(row: VendorRow): Result<Vendor, DatabaseFailure>;
  public domain(
    row: VendorRow | undefined,
    notFound: DatabaseFailure,
  ): Result<Vendor, DatabaseFailure>;
  public domain(rows: readonly VendorRow[]): Result<Vendor[], DatabaseFailure>;
  public domain(
    input: VendorRow | readonly VendorRow[] | undefined,
    notFound?: DatabaseFailure,
  ): Result<Vendor, DatabaseFailure> | Result<Vendor[], DatabaseFailure> {
    if (input === undefined) {
      return this.delegate.domain(input, notFound as DatabaseFailure);
    }

    return this.delegate.domain(input as VendorRow);
  }

  private toRow(vendor: Vendor): VendorRow {
    const plain = Vendor.plain(vendor);
    const base = {
      id: plain.id,
      vendorDomain: plain.vendorDomain,
      website: plain.website,
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
    };

    return match(plain)
      .with({ _tag: 'provisional' }, () => ({
        ...base,
        tag: 'provisional' as const,
        name: null,
        currency: null,
      }))
      .with({ _tag: 'resolved' }, (p) => ({
        ...base,
        tag: 'resolved' as const,
        name: p.name,
        currency: p.currency,
      }))
      .exhaustive();
  }

  private toPlainVendor(row: VendorRow): Plain<Vendor> {
    const base = {
      id: row.id as Id,
      vendorDomain: row.vendorDomain as VendorDomain,
      website: row.website as Url,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    return match(row)
      .with({ tag: 'provisional' }, () => ({
        ...base,
        _tag: 'provisional' as const,
      }))
      .with({ tag: 'resolved' }, (r) => ({
        ...base,
        _tag: 'resolved' as const,
        name: r.name as string,
        currency: r.currency as Currency,
      }))
      .exhaustive();
  }
}

import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Vendor } from '@wish-list/domain';
import type { Plain, VendorDomain } from '@wish-list/domain';
import { AsyncResult, Result } from '@wish-list/common-result';
import { Failure } from '@wish-list/common-error';
import { Repository, wrap } from '../repository/repository.js';
import type { DatabaseFailure } from '../database-failure/database-failure.js';
import { vendors } from './vendor.schema.js';

export class VendorRepository extends Repository<
  Vendor,
  Plain<Vendor>,
  typeof vendors
> {
  public constructor(db: LibSQLDatabase) {
    super({
      db,
      table: vendors,
      toRow: Vendor.plain,
      fromRow: wrap(Vendor.from),
    });
  }

  public findByVendorDomain(
    domain: VendorDomain,
  ): AsyncResult<Vendor, DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.db
          .select()
          .from(this.table)
          .where(eq(this.table.vendorDomain, domain))
          .then((rows) => rows[0] as Plain<Vendor> | undefined),
      (error) => this.translate(error),
    ).andThen((row) =>
      row === undefined
        ? Result.err(
            Failure.create('notFound', 'Entity not found', {
              vendorDomain: domain,
            }),
          )
        : this.fromRowFn(row),
    );
  }
}

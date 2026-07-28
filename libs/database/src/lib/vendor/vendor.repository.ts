import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Vendor } from '@wish-list/domain';
import type { Plain, VendorDomain } from '@wish-list/domain';
import { AsyncResult } from '@wish-list/common-result';
import { Failure } from '@wish-list/common-error';
import { Repository } from '../repository/repository.js';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';
import { vendors } from './vendor.schema.js';

export class VendorRepository extends Repository<
  Vendor,
  Plain<Vendor>,
  typeof vendors
> {
  private readonly _mapper = DatabaseDomainMapper.create(
    Vendor.plain,
    Vendor.from,
  );

  public constructor(db: LibSQLDatabase) {
    super({
      db,
      table: vendors,
    });
  }

  protected mapper(): DatabaseDomainMapper<Vendor, Plain<Vendor>> {
    return this._mapper;
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
      (error) => DatabaseError.from(error).failure(),
    ).andThen((row) =>
      this.mapper().domain(
        row,
        Failure.create('notFound', 'Entity not found', {
          vendorDomain: domain,
        }),
      ),
    );
  }
}

import { Inject, Injectable } from '@nestjs/common';
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
import { DATABASE_CLIENT } from '../database-client.token.js';
import { VENDOR_MAPPER } from './vendor.mapper.js';
import { vendors } from './vendor.schema.js';

@Injectable()
export class VendorRepository extends Repository<
  Vendor,
  Plain<Vendor>,
  typeof vendors
> {
  public constructor(
    @Inject(DATABASE_CLIENT) db: LibSQLDatabase,
    @Inject(VENDOR_MAPPER)
    private readonly _mapper: DatabaseDomainMapper<Vendor, Plain<Vendor>>,
  ) {
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

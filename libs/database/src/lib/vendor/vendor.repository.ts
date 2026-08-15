import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Vendor } from '@wish-list/domain';
import type { Plain, VendorDomain, Id } from '@wish-list/domain';
import { AsyncResult } from '@wish-list/common-result';
import { Failure } from '@wish-list/common-error';
import type {
  Readable,
  Insertable,
  Updatable,
} from '../repository/capability.js';
import {
  find,
  insert,
  update,
  type RepositoryOptions,
} from '../repository/operation.js';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { VENDOR_MAPPER } from './vendor.mapper.js';
import { vendors } from './vendor.schema.js';

@Injectable()
export class VendorRepository
  implements Readable<Vendor>, Insertable<Vendor>, Updatable<Vendor>
{
  private readonly options: RepositoryOptions<Vendor, Plain<Vendor>, typeof vendors>;

  public constructor(
    @Inject(DATABASE_CLIENT) db: LibSQLDatabase,
    @Inject(VENDOR_MAPPER)
    mapper: DatabaseDomainMapper<Vendor, Plain<Vendor>>,
  ) {
    this.options = { db, table: vendors, mapper };
  }

  public find(id: Id): AsyncResult<Vendor, DatabaseFailure> {
    return find(this.options, id);
  }

  public insert(entity: Vendor): AsyncResult<Vendor, DatabaseFailure> {
    return insert(this.options, entity);
  }

  public update(entity: Vendor): AsyncResult<Vendor, DatabaseFailure> {
    return update(this.options, entity);
  }

  public findByVendorDomain(
    domain: VendorDomain,
  ): AsyncResult<Vendor, DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.options.db
          .select()
          .from(this.options.table)
          .where(eq(this.options.table.vendorDomain, domain))
          .then((rows) => rows[0] as Plain<Vendor> | undefined),
      (error) => DatabaseError.from(error).failure(),
    ).andThen((row) =>
      this.options.mapper.domain(
        row,
        Failure.create('not-found', 'Entity not found', {
          vendorDomain: domain,
        }),
      ),
    );
  }
}

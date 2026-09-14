import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Vendor } from '@wish-list/domain';
import type { VendorDomain, Id } from '@wish-list/domain';
import { AsyncResult, Option, ok, type Result } from '@wish-list/common-result';
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
import { VendorDatabaseDomainMapper } from './vendor.mapper.js';
import type { VendorRow } from './vendor.mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { vendors } from './vendor.schema.js';

@Injectable()
export class VendorRepository
  implements Readable<Vendor>, Insertable<Vendor>, Updatable<Vendor>
{
  private readonly options: RepositoryOptions<
    Vendor,
    VendorRow,
    typeof vendors
  >;

  public constructor(
    @Inject(DATABASE_CLIENT) db: LibSQLDatabase,
    mapper: VendorDatabaseDomainMapper,
  ) {
    this.options = { db, table: vendors, mapper };
  }

  public find(id: Id): AsyncResult<Option<Vendor>, DatabaseFailure> {
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
  ): AsyncResult<Option<Vendor>, DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.options.db
          .select()
          .from(this.options.table)
          .where(eq(this.options.table.vendorDomain, domain))
          .then((rows) => rows[0] as VendorRow | undefined),
      (error) => DatabaseError.from(error).failure(),
    ).andThen(
      (row): Result<Option<Vendor>, DatabaseFailure> =>
        row === undefined
          ? ok(Option.none())
          : this.options.mapper.domain(row).map(Option.some),
    );
  }
}

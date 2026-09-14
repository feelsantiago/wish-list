import { Inject, Injectable } from '@nestjs/common';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Vendor } from '@wish-list/domain';
import type { Id } from '@wish-list/domain';
import { AsyncResult, type Option } from '@wish-list/common-result';
import type {
  Readable,
  Insertable,
  Updatable,
  Listable,
} from '../repository/capability.js';
import {
  find,
  all,
  insert,
  update,
  type RepositoryOptions,
} from '../repository/operation.js';
import { QueryScope } from '../repository/query-scope.js';
import { VendorDatabaseDomainMapper } from './vendor.mapper.js';
import type { VendorRow } from './vendor.mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { vendors } from './vendor.schema.js';

@Injectable()
export class VendorRepository
  implements
    Readable<Vendor>,
    Insertable<Vendor>,
    Updatable<Vendor>,
    Listable<Vendor, typeof vendors>
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
    return find(this.options, id, QueryScope.all());
  }

  public insert(entity: Vendor): AsyncResult<Vendor, DatabaseFailure> {
    return insert(this.options, entity);
  }

  public update(entity: Vendor): AsyncResult<Vendor, DatabaseFailure> {
    return update(this.options, entity);
  }

  public all(scope: QueryScope<typeof vendors>): AsyncResult<Vendor[], DatabaseFailure> {
    return all(this.options, scope);
  }
}

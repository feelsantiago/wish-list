import { Inject, Injectable } from '@nestjs/common';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { TrackedItem } from '@wish-list/domain';
import type { Plain, Id } from '@wish-list/domain';
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
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { TRACKED_ITEM_MAPPER } from './tracked-item.mapper.js';
import { trackedItems } from './tracked-item.schema.js';

@Injectable()
export class TrackedItemRepository
  implements
    Readable<TrackedItem>,
    Insertable<TrackedItem>,
    Updatable<TrackedItem>,
    Listable<TrackedItem, typeof trackedItems>
{
  private readonly options: RepositoryOptions<
    TrackedItem,
    Plain<TrackedItem>,
    typeof trackedItems
  >;

  public constructor(
    @Inject(DATABASE_CLIENT) db: LibSQLDatabase,
    @Inject(TRACKED_ITEM_MAPPER)
    mapper: DatabaseDomainMapper<TrackedItem, Plain<TrackedItem>>,
  ) {
    this.options = { db, table: trackedItems, mapper };
  }

  public find(id: Id): AsyncResult<Option<TrackedItem>, DatabaseFailure> {
    return find(this.options, id, QueryScope.all());
  }

  public insert(
    entity: TrackedItem,
  ): AsyncResult<TrackedItem, DatabaseFailure> {
    return insert(this.options, entity);
  }

  public update(
    entity: TrackedItem,
  ): AsyncResult<TrackedItem, DatabaseFailure> {
    return update(this.options, entity);
  }

  public all(
    scope: QueryScope<typeof trackedItems>,
  ): AsyncResult<TrackedItem[], DatabaseFailure> {
    return all(this.options, scope);
  }
}

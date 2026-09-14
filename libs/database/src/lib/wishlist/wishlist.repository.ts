import { Inject, Injectable } from '@nestjs/common';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Wishlist } from '@wish-list/domain';
import type { Plain, Id } from '@wish-list/domain';
import { AsyncResult, type Option } from '@wish-list/common-result';
import type {
  ScopedReadable,
  Insertable,
  ScopedUpdatable,
  ScopedDeletable,
  Listable,
} from '../repository/capability.js';
import {
  find,
  all,
  insert,
  updateScoped,
  removeScoped,
  type RepositoryOptions,
} from '../repository/operation.js';
import type { QueryScope } from '../repository/query-scope.js';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { WISHLIST_MAPPER } from './wishlist.mapper.js';
import { wishlists } from './wishlist.schema.js';

@Injectable()
export class WishlistRepository
  implements
    ScopedReadable<Wishlist, typeof wishlists>,
    Insertable<Wishlist>,
    ScopedUpdatable<Wishlist, typeof wishlists>,
    ScopedDeletable<typeof wishlists>,
    Listable<Wishlist, typeof wishlists>
{
  private readonly options: RepositoryOptions<
    Wishlist,
    Plain<Wishlist>,
    typeof wishlists
  >;

  public constructor(
    @Inject(DATABASE_CLIENT) db: LibSQLDatabase,
    @Inject(WISHLIST_MAPPER)
    mapper: DatabaseDomainMapper<Wishlist, Plain<Wishlist>>,
  ) {
    this.options = { db, table: wishlists, mapper };
  }

  public find(
    id: Id,
    scope: QueryScope<typeof wishlists>,
  ): AsyncResult<Option<Wishlist>, DatabaseFailure> {
    return find(this.options, id, scope);
  }

  public insert(entity: Wishlist): AsyncResult<Wishlist, DatabaseFailure> {
    return insert(this.options, entity);
  }

  public update(
    entity: Wishlist,
    scope: QueryScope<typeof wishlists>,
  ): AsyncResult<Option<Wishlist>, DatabaseFailure> {
    return updateScoped(this.options, entity, scope);
  }

  public delete(
    id: Id,
    scope: QueryScope<typeof wishlists>,
  ): AsyncResult<Option<Id>, DatabaseFailure> {
    return removeScoped(this.options, id, scope);
  }

  public all(
    scope: QueryScope<typeof wishlists>,
  ): AsyncResult<Wishlist[], DatabaseFailure> {
    return all(this.options, scope);
  }
}

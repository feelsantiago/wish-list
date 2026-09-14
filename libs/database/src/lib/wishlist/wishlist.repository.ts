import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Wishlist } from '@wish-list/domain';
import type { Plain, Id } from '@wish-list/domain';
import { AsyncResult, type Option } from '@wish-list/common-result';
import type {
  Readable,
  ReadableForUser,
  Insertable,
  Updatable,
} from '../repository/capability.js';
import {
  find,
  findForUser,
  insert,
  update,
  type RepositoryOptions,
} from '../repository/operation.js';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { WISHLIST_MAPPER } from './wishlist.mapper.js';
import { wishlists } from './wishlist.schema.js';

@Injectable()
export class WishlistRepository
  implements
    Readable<Wishlist>,
    ReadableForUser<Wishlist>,
    Insertable<Wishlist>,
    Updatable<Wishlist>
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

  public find(id: Id): AsyncResult<Wishlist, DatabaseFailure> {
    return find(this.options, id);
  }

  public findForUser(
    user: Id,
    id: Id,
  ): AsyncResult<Option<Wishlist>, DatabaseFailure> {
    return findForUser(this.options, user, id);
  }

  public insert(entity: Wishlist): AsyncResult<Wishlist, DatabaseFailure> {
    return insert(this.options, entity);
  }

  public update(entity: Wishlist): AsyncResult<Wishlist, DatabaseFailure> {
    return update(this.options, entity);
  }

  public findByUser(user: Id): AsyncResult<Wishlist[], DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.options.db
          .select()
          .from(this.options.table)
          .where(eq(this.options.table.user, user)) as unknown as Promise<
          Plain<Wishlist>[]
        >,
      (error) => DatabaseError.from(error).failure(),
    ).andThen((rows) => this.options.mapper.domain(rows));
  }
}

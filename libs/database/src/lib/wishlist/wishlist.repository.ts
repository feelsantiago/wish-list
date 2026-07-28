import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Wishlist } from '@wish-list/domain';
import type { Plain, Id } from '@wish-list/domain';
import { AsyncResult } from '@wish-list/common-result';
import { Repository } from '../repository/repository.js';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';
import { wishlists } from './wishlist.schema.js';

export class WishlistRepository extends Repository<
  Wishlist,
  Plain<Wishlist>,
  typeof wishlists
> {
  private readonly _mapper = DatabaseDomainMapper.create(
    Wishlist.plain,
    Wishlist.from,
  );

  public constructor(db: LibSQLDatabase) {
    super({
      db,
      table: wishlists,
    });
  }

  protected mapper(): DatabaseDomainMapper<Wishlist, Plain<Wishlist>> {
    return this._mapper;
  }

  public findByUser(user: Id): AsyncResult<Wishlist[], DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.db.select().from(this.table).where(eq(this.table.user, user)) as unknown as Promise<
          Plain<Wishlist>[]
        >,
      (error) => DatabaseError.from(error).failure(),
    ).andThen((rows) => this.mapper().domain(rows));
  }
}

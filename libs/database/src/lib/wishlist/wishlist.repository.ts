import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Wishlist } from '@wish-list/domain';
import type { Plain, Id } from '@wish-list/domain';
import { AsyncResult } from '@wish-list/common-result';
import { Repository, wrap } from '../repository/repository.js';
import type { DatabaseFailure } from '../database-failure/database-failure.js';
import { wishlists } from './wishlist.schema.js';

export class WishlistRepository extends Repository<
  Wishlist,
  Plain<Wishlist>,
  typeof wishlists
> {
  public constructor(db: LibSQLDatabase) {
    super({
      db,
      table: wishlists,
      toRow: Wishlist.plain,
      fromRow: wrap(Wishlist.from),
    });
  }

  public findByUser(user: Id): AsyncResult<Wishlist[], DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.db
          .select()
          .from(this.table)
          .where(eq(this.table.user, user))
          .then((rows) => rows as Plain<Wishlist>[]),
      (error) => this.translate(error),
    ).andThen((rows) => this.sequence(rows));
  }
}

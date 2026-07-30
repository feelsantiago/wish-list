import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Wishlist } from '@wish-list/domain';
import type { Plain, Id } from '@wish-list/domain';
import { AsyncResult } from '@wish-list/common-result';
import { Repository } from '../repository/repository.js';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { WISHLIST_MAPPER } from './wishlist.mapper.js';
import { wishlists } from './wishlist.schema.js';

@Injectable()
export class WishlistRepository extends Repository<
  Wishlist,
  Plain<Wishlist>,
  typeof wishlists
> {
  public constructor(
    @Inject(DATABASE_CLIENT) db: LibSQLDatabase,
    @Inject(WISHLIST_MAPPER)
    private readonly _mapper: DatabaseDomainMapper<Wishlist, Plain<Wishlist>>,
  ) {
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

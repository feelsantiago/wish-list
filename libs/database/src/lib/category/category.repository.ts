import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Category } from '@wish-list/domain';
import type { Plain, Id } from '@wish-list/domain';
import { AsyncResult } from '@wish-list/common-result';
import { Repository } from '../repository/repository.js';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { CATEGORY_MAPPER } from './category.mapper.js';
import { categories } from './category.schema.js';

@Injectable()
export class CategoryRepository extends Repository<
  Category,
  Plain<Category>,
  typeof categories
> {
  public constructor(
    @Inject(DATABASE_CLIENT) db: LibSQLDatabase,
    @Inject(CATEGORY_MAPPER)
    private readonly _mapper: DatabaseDomainMapper<Category, Plain<Category>>,
  ) {
    super({
      db,
      table: categories,
    });
  }

  protected mapper(): DatabaseDomainMapper<Category, Plain<Category>> {
    return this._mapper;
  }

  public findByUser(user: Id): AsyncResult<Category[], DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.db.select().from(this.table).where(eq(this.table.user, user)) as unknown as Promise<
          Plain<Category>[]
        >,
      (error) => DatabaseError.from(error).failure(),
    ).andThen((rows) => this.mapper().domain(rows));
  }
}

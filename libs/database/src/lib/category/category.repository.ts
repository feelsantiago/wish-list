import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Category } from '@wish-list/domain';
import type { Plain, Id } from '@wish-list/domain';
import { AsyncResult } from '@wish-list/common-result';
import { Repository, wrap } from '../repository/repository.js';
import type { DatabaseFailure } from '../database-failure/database-failure.js';
import { categories } from './category.schema.js';

export class CategoryRepository extends Repository<
  Category,
  Plain<Category>,
  typeof categories
> {
  public constructor(db: LibSQLDatabase) {
    super({
      db,
      table: categories,
      toRow: Category.plain,
      fromRow: wrap(Category.from),
    });
  }

  public findByUser(user: Id): AsyncResult<Category[], DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.db
          .select()
          .from(this.table)
          .where(eq(this.table.user, user))
          .then((rows) => rows as Plain<Category>[]),
      (error) => this.translate(error),
    ).andThen((rows) => this.sequence(rows));
  }
}

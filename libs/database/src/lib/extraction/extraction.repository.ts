import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Extraction } from '@wish-list/domain';
import type { ExtractionKey, Id } from '@wish-list/domain';
import { AsyncResult } from '@wish-list/common-result';
import { Failure } from '@wish-list/common-error';
import type { Readable, Insertable } from '../repository/capability.js';
import {
  find,
  insert,
  type RepositoryOptions,
} from '../repository/operation.js';
import { ExtractionDatabaseDomainMapper } from './extraction.mapper.js';
import type { ExtractionRow } from './extraction.mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { extractions } from './extraction.schema.js';

@Injectable()
export class ExtractionRepository
  implements Readable<Extraction>, Insertable<Extraction>
{
  private readonly options: RepositoryOptions<
    Extraction,
    ExtractionRow,
    typeof extractions
  >;

  public constructor(
    @Inject(DATABASE_CLIENT) db: LibSQLDatabase,
    mapper: ExtractionDatabaseDomainMapper,
  ) {
    this.options = { db, table: extractions, mapper };
  }

  public find(id: Id): AsyncResult<Extraction, DatabaseFailure> {
    return find(this.options, id);
  }

  public insert(entity: Extraction): AsyncResult<Extraction, DatabaseFailure> {
    return insert(this.options, entity);
  }

  public findLatestByKey(
    key: ExtractionKey,
  ): AsyncResult<Extraction, DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.options.db
          .select()
          .from(this.options.table)
          .where(eq(this.options.table.key, key))
          .orderBy(desc(this.options.table.createdAt))
          .limit(1)
          .then((rows) => rows[0] as ExtractionRow | undefined),
      (error) => DatabaseError.from(error).failure(),
    ).andThen((row) =>
      this.options.mapper.domain(
        row,
        Failure.create('not-found', 'Entity not found', { key }),
      ),
    );
  }
}

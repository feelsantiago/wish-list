import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Reservation } from '@wish-list/domain';
import type { Plain, Id } from '@wish-list/domain';
import { AsyncResult, type Option } from '@wish-list/common-result';
import type {
  Readable,
  Insertable,
  Deletable,
} from '../repository/capability.js';
import {
  find,
  insert,
  remove,
  type RepositoryOptions,
} from '../repository/operation.js';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { RESERVATION_MAPPER } from './reservation.mapper.js';
import { reservations } from './reservation.schema.js';

@Injectable()
export class ReservationRepository
  implements Readable<Reservation>, Insertable<Reservation>, Deletable
{
  private readonly options: RepositoryOptions<
    Reservation,
    Plain<Reservation>,
    typeof reservations
  >;

  public constructor(
    @Inject(DATABASE_CLIENT) db: LibSQLDatabase,
    @Inject(RESERVATION_MAPPER)
    mapper: DatabaseDomainMapper<Reservation, Plain<Reservation>>,
  ) {
    this.options = { db, table: reservations, mapper };
  }

  public find(id: Id): AsyncResult<Option<Reservation>, DatabaseFailure> {
    return find(this.options, id);
  }

  public insert(
    entity: Reservation,
  ): AsyncResult<Reservation, DatabaseFailure> {
    return insert(this.options, entity);
  }

  public delete(id: Id): AsyncResult<void, DatabaseFailure> {
    return remove(this.options, id);
  }

  public findByItem(item: Id): AsyncResult<Reservation[], DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.options.db
          .select()
          .from(this.options.table)
          .where(eq(this.options.table.item, item)) as unknown as Promise<
          Plain<Reservation>[]
        >,
      (error) => DatabaseError.from(error).failure(),
    ).andThen((rows) => this.options.mapper.domain(rows));
  }
}

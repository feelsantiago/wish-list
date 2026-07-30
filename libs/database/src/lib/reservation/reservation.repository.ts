import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Reservation } from '@wish-list/domain';
import type { Plain, Id } from '@wish-list/domain';
import { AsyncResult } from '@wish-list/common-result';
import { Repository } from '../repository/repository.js';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';
import { DATABASE_CLIENT } from '../client/client.token.js';
import { RESERVATION_MAPPER } from './reservation.mapper.js';
import { reservations } from './reservation.schema.js';

@Injectable()
export class ReservationRepository extends Repository<
  Reservation,
  Plain<Reservation>,
  typeof reservations
> {
  public constructor(
    @Inject(DATABASE_CLIENT) db: LibSQLDatabase,
    @Inject(RESERVATION_MAPPER)
    private readonly _mapper: DatabaseDomainMapper<
      Reservation,
      Plain<Reservation>
    >,
  ) {
    super({
      db,
      table: reservations,
    });
  }

  protected mapper(): DatabaseDomainMapper<Reservation, Plain<Reservation>> {
    return this._mapper;
  }

  public findByItem(item: Id): AsyncResult<Reservation[], DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.db
          .select()
          .from(this.table)
          .where(eq(this.table.item, item)) as unknown as Promise<
          Plain<Reservation>[]
        >,
      (error) => DatabaseError.from(error).failure(),
    ).andThen((rows) => this.mapper().domain(rows));
  }
}

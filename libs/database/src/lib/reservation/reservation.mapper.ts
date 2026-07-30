import type { Provider } from '@nestjs/common';
import { Reservation } from '@wish-list/domain';
import type { Plain } from '@wish-list/domain';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';

export const RESERVATION_MAPPER = Symbol('RESERVATION_MAPPER');

export function createReservationMapper(): DatabaseDomainMapper<
  Reservation,
  Plain<Reservation>
> {
  return DatabaseDomainMapper.create(Reservation.plain, Reservation.from);
}

export const reservationMapperProvider: Provider = {
  provide: RESERVATION_MAPPER,
  useFactory: createReservationMapper,
};

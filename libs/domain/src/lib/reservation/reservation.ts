import { randomUUID } from 'node:crypto';
import { z, ZodError } from 'zod';
import { Result } from '@wish-list/common-result';
import type { Plain } from '../plain/plain.js';
import { Id } from '../id/id.js';
import { DomainFailure } from '../domain-failure/domain-failure.js';

export interface Reservation {
  readonly id: Id;
  readonly item: Id;
  readonly name: string;
  readonly token: string;
  readonly createdAt: Date;
}

export namespace Reservation {
  export const $ = z.object({
    name: z.string().min(1),
  });

  export interface CreateInput {
    readonly item: Id;
    readonly name: string;
  }

  export function create(
    input: CreateInput,
  ): Result<Reservation, DomainFailure> {
    return Result.fromThrowable<z.infer<typeof $>, ZodError>(() =>
      $.parse({ name: input.name }),
    )
      .mapErr((error) =>
        DomainFailure.validation(input, error).context('Creating Reservation'),
      )
      .map((value) => ({
        id: Id.generate(),
        item: input.item,
        name: value.name,
        token: randomUUID(),
        createdAt: new Date(),
      }));
  }

  export function from(plain: Plain<Reservation>): Reservation {
    return {
      id: plain.id as Id,
      item: plain.item as Id,
      name: plain.name,
      token: plain.token,
      createdAt: new Date(plain.createdAt),
    };
  }

  export function plain(reservation: Reservation): Plain<Reservation> {
    return {
      id: reservation.id,
      item: reservation.item,
      name: reservation.name,
      token: reservation.token,
      createdAt: reservation.createdAt.toISOString(),
    };
  }
}

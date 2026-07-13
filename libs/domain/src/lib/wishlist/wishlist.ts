import { z, ZodError } from 'zod';
import { Result } from '@wish-list/common-result';
import type { Plain } from '../plain/plain.js';
import { Id } from '../id/id.js';
import { DomainFailure } from '../domain-failure/domain-failure.js';

export interface Wishlist {
  readonly id: Id;
  readonly user: Id;
  readonly name: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export namespace Wishlist {
  export const $ = z.object({
    name: z.string().min(1),
  });

  export interface CreateInput {
    readonly user: Id;
    readonly name: string;
  }

  export function create(
    input: CreateInput,
  ): Result<Wishlist, DomainFailure> {
    return Result.fromThrowable<z.infer<typeof $>, ZodError>(() =>
      $.parse({ name: input.name }),
    )
      .mapErr((error) =>
        DomainFailure.validation(input, error).context('Creating Wishlist'),
      )
      .map((value) => {
        const now = new Date();
        return {
          id: Id.generate(),
          user: input.user,
          name: value.name,
          createdAt: now,
          updatedAt: now,
        };
      });
  }

  export function rename(
    wishlist: Wishlist,
    name: string,
  ): Result<Wishlist, DomainFailure> {
    return Result.fromThrowable<z.infer<typeof $>, ZodError>(() =>
      $.parse({ name }),
    )
      .mapErr((error) =>
        DomainFailure.validation(name, error).context('Renaming Wishlist'),
      )
      .map((value) => ({
        ...wishlist,
        name: value.name,
        updatedAt: new Date(),
      }));
  }

  export function from(plain: Plain<Wishlist>): Wishlist {
    return {
      id: plain.id as Id,
      user: plain.user as Id,
      name: plain.name,
      createdAt: new Date(plain.createdAt),
      updatedAt: new Date(plain.updatedAt),
    };
  }

  export function plain(wishlist: Wishlist): Plain<Wishlist> {
    return {
      id: wishlist.id,
      user: wishlist.user,
      name: wishlist.name,
      createdAt: wishlist.createdAt.toISOString(),
      updatedAt: wishlist.updatedAt.toISOString(),
    };
  }
}

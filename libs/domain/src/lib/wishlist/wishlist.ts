import { randomUUID } from 'node:crypto';
import { z, ZodError } from 'zod';
import { Result } from '@wish-list/common-result';
import type { Plain } from '../plain/plain.js';
import { Id } from '../id/id.js';
import { DomainFailure } from '../domain-failure/domain-failure.js';

export type WishlistStyle = 'default' | 'surprise';

export interface Wishlist {
  readonly id: Id;
  readonly user: Id;
  readonly name: string;
  readonly slug: string;
  readonly published: boolean;
  readonly style: WishlistStyle;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type DefaultWishlist = Wishlist & { readonly style: 'default' };
export type SurpriseWishlist = Wishlist & { readonly style: 'surprise' };

export namespace Wishlist {
  export const $ = z.object({
    name: z.string().min(1),
    style: z.enum(['default', 'surprise']).default('surprise'),
  });

  export interface CreateInput {
    readonly user: Id;
    readonly name: string;
    readonly style?: WishlistStyle;
  }

  export function create(
    input: CreateInput,
  ): Result<Wishlist, DomainFailure> {
    return Result.fromThrowable<z.infer<typeof $>, ZodError>(() =>
      $.parse({ name: input.name, style: input.style }),
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
          slug: randomUUID(),
          published: true,
          style: value.style,
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

  export function regenerateSlug(wishlist: Wishlist): Wishlist {
    return {
      ...wishlist,
      slug: randomUUID(),
      updatedAt: new Date(),
    };
  }

  export function publish(wishlist: Wishlist): Wishlist {
    return {
      ...wishlist,
      published: true,
      updatedAt: new Date(),
    };
  }

  export function unpublish(wishlist: Wishlist): Wishlist {
    return {
      ...wishlist,
      published: false,
      updatedAt: new Date(),
    };
  }

  export function from(plain: Plain<Wishlist>): Wishlist {
    return {
      id: plain.id as Id,
      user: plain.user as Id,
      name: plain.name,
      slug: plain.slug,
      published: plain.published,
      style: plain.style,
      createdAt: new Date(plain.createdAt),
      updatedAt: new Date(plain.updatedAt),
    };
  }

  export function plain(wishlist: Wishlist): Plain<Wishlist> {
    return {
      id: wishlist.id,
      user: wishlist.user,
      name: wishlist.name,
      slug: wishlist.slug,
      published: wishlist.published,
      style: wishlist.style,
      createdAt: wishlist.createdAt.toISOString(),
      updatedAt: wishlist.updatedAt.toISOString(),
    };
  }
}

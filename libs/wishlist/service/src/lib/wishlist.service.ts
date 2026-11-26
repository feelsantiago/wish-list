import { Inject, Injectable } from '@nestjs/common';
import { ServiceFailure } from '@wish-list/common-error/service';
import { AsyncResult } from '@wish-list/common-result';
import { Wishlist } from '@wish-list/domain';
import type { ActiveUser } from '@wish-list/domain';
import { QueryScope, WishlistRepository } from '@wish-list/database';
import type { CreateWishlistRequest } from '@wish-list/wishlist-data';

/**
 * Wishlists owned by the caller. Returns domain types; the HTTP edge calls
 * `Wishlist.plain` (ADR-0043).
 */
@Injectable()
export class WishlistService {
  public constructor(
    @Inject(WishlistRepository) private readonly wishlists: WishlistRepository,
  ) {}

  /**
   * The pipe already validated `request` against the same schema; a domain
   * rejection here is still reported as `invalid`, never trusted away.
   */
  public create(
    user: ActiveUser,
    request: CreateWishlistRequest,
  ): AsyncResult<Wishlist, ServiceFailure> {
    return AsyncResult.fromResult(
      Wishlist.create({ user: user.id, ...request }).mapErr(
        (failure): ServiceFailure => ServiceFailure.invalid(failure),
      ),
    ).andThen((wishlist) =>
      this.wishlists
        .insert(wishlist)
        .mapErr((failure): ServiceFailure =>
          ServiceFailure.unexpected(failure),
        ),
    );
  }

  /** A collection read: scoped to the caller, no authorizer (ADR-0029). */
  public list(user: ActiveUser): AsyncResult<Wishlist[], ServiceFailure> {
    return this.wishlists
      .all(QueryScope.user(user.id))
      .mapErr((failure): ServiceFailure => ServiceFailure.unexpected(failure));
  }
}

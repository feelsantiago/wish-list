import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import type { ServiceFailure } from '@wish-list/common-error/service';
import type { AsyncResult } from '@wish-list/common-result';
import { Each } from '@wish-list/common-utils';
import { Wishlist } from '@wish-list/domain';
import type { ActiveUser } from '@wish-list/domain';
import type { WishlistResponse } from '@wish-list/wishlist-data';
import { WishlistService } from '@wish-list/wishlist-service';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CreateWishlistDto } from './create-wishlist.dto.js';

/** The caller's own Wishlists. Serialises with `Wishlist.plain` (ADR-0043). */
@Controller('wishlists')
export class WishlistController {
  public constructor(
    @Inject(WishlistService) private readonly wishlists: WishlistService,
  ) {}

  @Post()
  public create(
    @CurrentUser() user: ActiveUser,
    @Body() body: CreateWishlistDto,
  ): AsyncResult<WishlistResponse, ServiceFailure> {
    return this.wishlists.create(user, body).map(Wishlist.plain);
  }

  @Get()
  public list(
    @CurrentUser() user: ActiveUser,
  ): AsyncResult<WishlistResponse[], ServiceFailure> {
    return this.wishlists.list(user).map(Each.map(Wishlist.plain));
  }
}

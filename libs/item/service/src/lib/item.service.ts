import { Injectable } from '@nestjs/common';
import { match } from 'ts-pattern';
import { AsyncResult, Result, err, ok } from '@wish-list/common-result';
import { Extraction, Id, Item, Url } from '@wish-list/domain';
import type { ExtractedItem, FailedExtractionItem } from '@wish-list/domain';
import {
  CategoryRepository,
  ItemRepository,
  WishlistRepository,
} from '@wish-list/database';
import type { DatabaseFailure } from '@wish-list/database';
import { Extractor } from '@wish-list/extraction';
import { ServiceFailure } from '@wish-list/common-error/service';

@Injectable()
export class ItemService {
  public constructor(
    private readonly wishlists: WishlistRepository,
    private readonly categories: CategoryRepository,
    private readonly items: ItemRepository,
    private readonly extractor: Extractor,
  ) {}

  public create(input: {
    user: Id;
    wishlist: Id;
    category: Id;
    url: string;
  }): AsyncResult<Item, ServiceFailure> {
    return new AsyncResult(
      Result.safeTry(this, async function* (this: ItemService) {
        const url = yield* Url.create(input.url).mapErr(ServiceFailure.invalid);
        yield* this.checkWishlist(input.wishlist, input.user);
        yield* this.checkCategory(input.category, input.user);
        const extraction = yield* this.extractor
          .extract(url)
          .mapErr((error) => ServiceFailure.unexpected(error));

        return this.reconcile(input, url, extraction).toPromise();
      }),
    );
  }

  private checkWishlist(
    wishlist: Id,
    user: Id,
  ): AsyncResult<void, ServiceFailure> {
    return this.checkOwnership(
      this.wishlists.find(wishlist),
      user,
      `wishlist:${wishlist}`,
    );
  }

  private checkCategory(
    category: Id,
    user: Id,
  ): AsyncResult<void, ServiceFailure> {
    return this.checkOwnership(
      this.categories.find(category),
      user,
      `category:${category}`,
    );
  }

  private checkOwnership<T extends { readonly user: Id }>(
    entity: AsyncResult<T, DatabaseFailure>,
    user: Id,
    resource: string,
  ): AsyncResult<void, ServiceFailure> {
    return entity
      .mapErr((error): ServiceFailure =>
        match(error.name)
          .with('not-found', () => ServiceFailure.notFound(resource))
          .otherwise(() => ServiceFailure.unexpected(error)),
      )
      .andThen((found) =>
        found.user === user
          ? ok(undefined)
          : err(ServiceFailure.forbidden(user, resource)),
      );
  }

  private reconcile(
    input: { wishlist: Id; category: Id },
    url: Url,
    extraction: Extraction,
  ): AsyncResult<Item, ServiceFailure> {
    const pending = Item.create({
      wishlist: input.wishlist,
      vendor: extraction.vendor,
      category: input.category,
      url,
    });

    const item = match(extraction)
      .with({ _tag: 'succeeded' }, (succeeded) =>
        Item.extract(pending, succeeded.data).match<
          ExtractedItem | FailedExtractionItem
        >({
          ok: (extracted) => extracted,
          err: () => Item.failed(pending, 'invalid-data'),
        }),
      )
      .with({ _tag: 'failed' }, (failed) => Item.failed(pending, failed.reason))
      .exhaustive();

    return this.items
      .insert(item)
      .mapErr((error) => ServiceFailure.unexpected(error));
  }
}

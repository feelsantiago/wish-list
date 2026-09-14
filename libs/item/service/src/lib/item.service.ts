import { Injectable } from '@nestjs/common';
import { match } from 'ts-pattern';
import { AsyncResult, Result, type Option } from '@wish-list/common-result';
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
import type { CreateItemInput } from './item.service.types.js';

@Injectable()
export class ItemService {
  public constructor(
    private readonly wishlists: WishlistRepository,
    private readonly categories: CategoryRepository,
    private readonly items: ItemRepository,
    private readonly extractor: Extractor,
  ) {}

  public create(input: CreateItemInput): AsyncResult<Item, ServiceFailure> {
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
    return this.checkExists(
      this.wishlists.findForUser(user, wishlist),
      `wishlist:${wishlist}`,
    );
  }

  private checkCategory(
    category: Id,
    user: Id,
  ): AsyncResult<void, ServiceFailure> {
    return this.checkExists(
      this.categories.findForUser(user, category),
      `category:${category}`,
    );
  }

  private checkExists<T>(
    entity: AsyncResult<Option<T>, DatabaseFailure>,
    resource: string,
  ): AsyncResult<void, ServiceFailure> {
    return entity
      .mapErr((error): ServiceFailure => ServiceFailure.unexpected(error))
      .andThen((found) => found.okOr(ServiceFailure.notFound(resource)))
      .map(() => undefined);
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

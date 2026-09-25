import { Injectable } from '@nestjs/common';
import { match } from 'ts-pattern';
import { AsyncResult, Result } from '@wish-list/common-result';
import { Extraction, Item, Url } from '@wish-list/domain';
import type {
  ExtractedItem,
  FailedExtractionItem,
  Id,
} from '@wish-list/domain';
import { ItemRepository } from '@wish-list/database';
import { Extractor } from '@wish-list/extraction';
import { ServiceFailure } from '@wish-list/common-error/service';
import type { CreateItemInput } from './item.service.types.js';

@Injectable()
export class ItemService {
  public constructor(
    private readonly items: ItemRepository,
    private readonly extractor: Extractor,
  ) {}

  public create(input: CreateItemInput): AsyncResult<Item, ServiceFailure> {
    return new AsyncResult(
      Result.safeTry(this, async function* (this: ItemService) {
        const extraction = yield* this.extractor
          .extract(input.url)
          .mapErr((error) => ServiceFailure.unexpected(error));

        return this.reconcile(
          {
            wishlist: input.authorized.wishlist.id,
            category: input.authorized.category.id,
          },
          input.url,
          extraction,
        ).toPromise();
      }),
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

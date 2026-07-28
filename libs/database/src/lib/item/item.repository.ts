import { eq } from 'drizzle-orm';
import { match } from 'ts-pattern';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { Item } from '@wish-list/domain';
import type { Currency, Id, Plain, Url } from '@wish-list/domain';
import { AsyncResult } from '@wish-list/common-result';
import { Repository } from '../repository/repository.js';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';
import { DatabaseError } from '../database-failure/database-error.js';
import { items } from './item.schema.js';

type ItemRow = typeof items.$inferSelect;

function toRow(item: Item): ItemRow {
  const base = {
    id: item.id,
    wishlist: item.wishlist,
    vendor: item.vendor,
    category: item.category,
    url: item.url,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };

  return match(item)
    .with({ _tag: 'pending' }, () => ({
      ...base,
      tag: 'pending' as const,
      name: null,
      priceAmount: null,
      priceCurrency: null,
      image: null,
      reason: null,
    }))
    .with({ _tag: 'extracted' }, (i) => ({
      ...base,
      tag: 'extracted' as const,
      name: i.name,
      priceAmount: i.price.amount,
      priceCurrency: i.price.currency,
      image: i.image,
      reason: null,
    }))
    .with({ _tag: 'failed' }, (i) => ({
      ...base,
      tag: 'failed' as const,
      name: null,
      priceAmount: null,
      priceCurrency: null,
      image: null,
      reason: i.reason,
    }))
    .exhaustive();
}

function toPlainItem(row: ItemRow): Plain<Item> {
  const base = {
    id: row.id as Id,
    wishlist: row.wishlist as Id,
    vendor: row.vendor as Id,
    category: row.category as Id,
    url: row.url as Url,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  return match(row)
    .with({ tag: 'pending' }, () => ({ ...base, _tag: 'pending' as const }))
    .with({ tag: 'extracted' }, (r) => ({
      ...base,
      _tag: 'extracted' as const,
      name: r.name as string,
      price: {
        amount: r.priceAmount as number,
        currency: r.priceCurrency as Currency,
      },
      image: r.image as Url,
    }))
    .with({ tag: 'failed' }, (r) => ({
      ...base,
      _tag: 'failed' as const,
      reason: r.reason as string,
    }))
    .exhaustive();
}

export class ItemRepository extends Repository<Item, ItemRow, typeof items> {
  private readonly _mapper = DatabaseDomainMapper.create(
    toRow,
    (row: ItemRow) => Item.from(toPlainItem(row)),
  );

  public constructor(db: LibSQLDatabase) {
    super({
      db,
      table: items,
    });
  }

  protected mapper(): DatabaseDomainMapper<Item, ItemRow> {
    return this._mapper;
  }

  public findByWishlist(wishlist: Id): AsyncResult<Item[], DatabaseFailure> {
    return AsyncResult.fromThrowable(
      () =>
        this.db
          .select()
          .from(this.table)
          .where(eq(this.table.wishlist, wishlist)) as unknown as Promise<
          ItemRow[]
        >,
      (error) => DatabaseError.from(error).failure(),
    ).andThen((rows) => this.mapper().domain(rows));
  }
}

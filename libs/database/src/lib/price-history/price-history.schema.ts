import { sqliteTable, text, real, index } from 'drizzle-orm/sqlite-core';
import { items } from '../item/item.schema.js';

export const priceHistory = sqliteTable(
  'price_history',
  {
    id: text('id').primaryKey(),
    item: text('item')
      .notNull()
      .references(() => items.id),
    priceAmount: real('price_amount').notNull(),
    priceCurrency: text('price_currency', { enum: ['USD', 'BRL'] }).notNull(),
    fetchedAt: text('fetched_at').notNull(),
  },
  (table) => [index('price_history_item_idx').on(table.item)],
);

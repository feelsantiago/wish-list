import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { items } from '../item/item.schema.js';

export const trackedItems = sqliteTable(
  'tracked_items',
  {
    id: text('id').primaryKey(),
    item: text('item')
      .notNull()
      .references(() => items.id),
    active: integer('active', { mode: 'boolean' }).notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('tracked_items_item_idx').on(table.item)],
);

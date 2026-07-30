import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { items } from '../item/item.schema.js';

export const reservations = sqliteTable(
  'reservations',
  {
    id: text('id').primaryKey(),
    item: text('item')
      .notNull()
      .references(() => items.id),
    name: text('name').notNull(),
    token: text('token').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [uniqueIndex('reservations_item_idx').on(table.item)],
);

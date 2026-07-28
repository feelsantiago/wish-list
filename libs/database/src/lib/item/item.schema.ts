import { sqliteTable, text, real, index } from 'drizzle-orm/sqlite-core';
import { wishlists } from '../wishlist/wishlist.schema.js';
import { vendors } from '../vendor/vendor.schema.js';
import { categories } from '../category/category.schema.js';

export const items = sqliteTable(
  'items',
  {
    id: text('id').primaryKey(),
    wishlist: text('wishlist')
      .notNull()
      .references(() => wishlists.id, { onDelete: 'cascade' }),
    vendor: text('vendor')
      .notNull()
      .references(() => vendors.id, { onDelete: 'restrict' }),
    category: text('category')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    url: text('url').notNull(),
    status: text('status', { enum: ['wanted', 'fulfilled'] }).notNull(),
    tag: text('tag', {
      enum: ['pending', 'extracted', 'failed'],
    }).notNull(),
    name: text('name'),
    priceAmount: real('price_amount'),
    priceCurrency: text('price_currency'),
    image: text('image'),
    reason: text('reason'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('items_wishlist_idx').on(table.wishlist),
    index('items_category_idx').on(table.category),
    index('items_vendor_idx').on(table.vendor),
  ],
);

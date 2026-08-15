import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const vendors = sqliteTable(
  'vendors',
  {
    id: text('id').primaryKey(),
    vendorDomain: text('vendor_domain').notNull(),
    website: text('website').notNull(),
    tag: text('tag', { enum: ['provisional', 'resolved'] }).notNull(),
    name: text('name'),
    currency: text('currency', { enum: ['USD', 'BRL'] }),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('vendors_vendor_domain_idx').on(table.vendorDomain)],
);

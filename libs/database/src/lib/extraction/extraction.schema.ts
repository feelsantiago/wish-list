import { sqliteTable, text, real, index } from 'drizzle-orm/sqlite-core';
import { vendors } from '../vendor/vendor.schema.js';

export const extractions = sqliteTable(
  'extractions',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(),
    url: text('url').notNull(),
    vendor: text('vendor')
      .notNull()
      .references(() => vendors.id, { onDelete: 'restrict' }),
    tag: text('tag', { enum: ['succeeded', 'failed'] }).notNull(),
    source: text('source', { enum: ['json-ld', 'opengraph', 'llm'] }),
    reason: text('reason', {
      enum: [
        'fetch-failed',
        'blocked',
        'timeout',
        'no-data',
        'unsupported-currency',
        'llm-failed',
      ],
    }),
    dataName: text('data_name'),
    dataPriceAmount: real('data_price_amount'),
    dataPriceCurrency: text('data_price_currency', { enum: ['USD', 'BRL'] }),
    dataImage: text('data_image'),
    vendorDataName: text('vendor_data_name'),
    vendorDataWebsite: text('vendor_data_website'),
    vendorDataCurrency: text('vendor_data_currency', {
      enum: ['USD', 'BRL'],
    }),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('extractions_key_created_at_idx').on(table.key, table.createdAt),
  ],
);

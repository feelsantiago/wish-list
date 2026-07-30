import {
  sqliteTable,
  text,
  real,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { users } from '../user/user.schema.js';
import { vendors } from '../vendor/vendor.schema.js';

export const coupons = sqliteTable(
  'coupons',
  {
    id: text('id').primaryKey(),
    user: text('user')
      .notNull()
      .references(() => users.id),
    vendor: text('vendor')
      .notNull()
      .references(() => vendors.id),
    code: text('code').notNull(),
    tag: text('tag', { enum: ['fixed', 'percentage'] }).notNull(),
    amountAmount: real('amount_amount'),
    amountCurrency: text('amount_currency', { enum: ['USD', 'BRL'] }),
    percentage: integer('percentage'),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('coupons_user_idx').on(table.user),
    index('coupons_vendor_idx').on(table.vendor),
    uniqueIndex('coupons_user_vendor_code_idx').on(
      table.user,
      table.vendor,
      table.code,
    ),
  ],
);

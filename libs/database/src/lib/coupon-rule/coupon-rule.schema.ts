import { sqliteTable, text, real, index } from 'drizzle-orm/sqlite-core';
import { coupons } from '../coupon/coupon.schema.js';

export const couponRules = sqliteTable(
  'coupon_rules',
  {
    id: text('id').primaryKey(),
    coupon: text('coupon')
      .notNull()
      .references(() => coupons.id),
    thresholdAmount: real('threshold_amount').notNull(),
    thresholdCurrency: text('threshold_currency', {
      enum: ['USD', 'BRL'],
    }).notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('coupon_rules_coupon_idx').on(table.coupon)],
);

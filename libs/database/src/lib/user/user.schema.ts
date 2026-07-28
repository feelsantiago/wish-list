import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    provider: text('provider').notNull(),
    providerId: text('provider_id').notNull(),
    plan: text('plan', { enum: ['free', 'pro'] }).notNull(),
    status: text('status', { enum: ['active', 'deactivated'] }).notNull(),
    deactivatedAt: text('deactivated_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('users_email_idx').on(table.email),
    uniqueIndex('users_provider_provider_id_idx').on(
      table.provider,
      table.providerId,
    ),
  ],
);

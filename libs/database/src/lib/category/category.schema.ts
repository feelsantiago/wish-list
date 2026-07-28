import { sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from '../user/user.schema.js';

export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    user: text('user')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    color: text('color'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('categories_user_idx').on(table.user),
    uniqueIndex('categories_user_name_idx').on(table.user, table.name),
  ],
);

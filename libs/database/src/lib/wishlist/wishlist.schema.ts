import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { users } from '../user/user.schema.js';

export const wishlists = sqliteTable(
  'wishlists',
  {
    id: text('id').primaryKey(),
    user: text('user')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    published: integer('published', { mode: 'boolean' }).notNull(),
    style: text('style', { enum: ['default', 'surprise'] }).notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('wishlists_user_idx').on(table.user),
    uniqueIndex('wishlists_slug_idx').on(table.slug),
  ],
);

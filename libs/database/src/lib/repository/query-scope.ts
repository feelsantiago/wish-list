import { eq } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { Id } from '@wish-list/domain';
import type { RepositoryTable } from './operation.js';

export type UserOwnedTable = RepositoryTable & { readonly user: SQLiteColumn };

export interface QueryScope<TTable extends RepositoryTable> {
  // property syntax, NOT method shorthand — method shorthand is bivariant and
  // silently destroys the gating described below
  readonly condition: (table: TTable) => SQL | undefined;
}

export namespace QueryScope {
  export function all(): QueryScope<RepositoryTable> {
    return { condition: () => undefined };
  }

  export function user(user: Id): QueryScope<UserOwnedTable> {
    return { condition: (table) => eq(table.user, user) };
  }
}

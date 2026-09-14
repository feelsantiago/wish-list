import { eq } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { Id } from '@wish-list/domain';
import type { RepositoryTable } from './operation.js';

export type UserOwnedTable = RepositoryTable & { readonly user: SQLiteColumn };

export interface QueryScope<TTable extends RepositoryTable> {
  condition(table: TTable): SQL | undefined;
}

export namespace QueryScope {
  export function all(): QueryScope<RepositoryTable> {
    return new AllScope();
  }

  export function user(user: Id): QueryScope<UserOwnedTable> {
    return new UserScope(user);
  }
}

class AllScope implements QueryScope<RepositoryTable> {
  public condition(): SQL | undefined {
    return undefined;
  }
}

class UserScope implements QueryScope<UserOwnedTable> {
  public constructor(private readonly user: Id) {}

  public condition(table: UserOwnedTable): SQL | undefined {
    return eq(table.user, this.user);
  }
}

import { eq } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { Id } from '@wish-list/domain';
import type { RepositoryTable } from './operation.js';

export type UserOwnedTable = RepositoryTable & { readonly user: SQLiteColumn };

export abstract class QueryScope<TTable extends RepositoryTable> {
  public abstract condition(table: TTable): SQL | undefined;

  public static all(): QueryScope<RepositoryTable> {
    return new AllScope();
  }

  public static user(user: Id): QueryScope<UserOwnedTable> {
    return new UserScope(user);
  }
}

class AllScope extends QueryScope<RepositoryTable> {
  public condition(): SQL | undefined {
    return undefined;
  }
}

class UserScope extends QueryScope<UserOwnedTable> {
  public constructor(private readonly user: Id) {
    super();
  }

  public condition(table: UserOwnedTable): SQL | undefined {
    return eq(table.user, this.user);
  }
}

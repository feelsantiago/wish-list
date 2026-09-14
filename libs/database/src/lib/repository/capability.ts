import type { Id } from '@wish-list/domain';
import type { AsyncResult, Option } from '@wish-list/common-result';
import type { DatabaseFailure } from '../database-failure/database-failure.js';
import type { RepositoryTable } from './operation.js';
import type { QueryScope } from './query-scope.js';

export interface Readable<TEntity> {
  find(id: Id): AsyncResult<Option<TEntity>, DatabaseFailure>;
}

export interface ScopedReadable<TEntity, TTable extends RepositoryTable> {
  find(
    id: Id,
    scope: QueryScope<TTable>,
  ): AsyncResult<Option<TEntity>, DatabaseFailure>;
}

export interface Insertable<TEntity> {
  insert(entity: TEntity): AsyncResult<TEntity, DatabaseFailure>;
}

export interface Updatable<TEntity> {
  update(entity: TEntity): AsyncResult<TEntity, DatabaseFailure>;
}

export interface ScopedUpdatable<TEntity, TTable extends RepositoryTable> {
  update(
    entity: TEntity,
    scope: QueryScope<TTable>,
  ): AsyncResult<Option<TEntity>, DatabaseFailure>;
}

export interface Deletable {
  delete(id: Id): AsyncResult<void, DatabaseFailure>;
}

export interface ScopedDeletable<TTable extends RepositoryTable> {
  delete(
    id: Id,
    scope: QueryScope<TTable>,
  ): AsyncResult<Option<Id>, DatabaseFailure>;
}

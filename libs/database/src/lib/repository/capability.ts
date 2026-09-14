import type { Id } from '@wish-list/domain';
import type { AsyncResult, Option } from '@wish-list/common-result';
import type { DatabaseFailure } from '../database-failure/database-failure.js';

export interface Readable<TEntity> {
  find(id: Id): AsyncResult<Option<TEntity>, DatabaseFailure>;
}

export interface ReadableForUser<TEntity> {
  findForUser(user: Id, id: Id): AsyncResult<Option<TEntity>, DatabaseFailure>;
}

export interface Insertable<TEntity> {
  insert(entity: TEntity): AsyncResult<TEntity, DatabaseFailure>;
}

export interface Updatable<TEntity> {
  update(entity: TEntity): AsyncResult<TEntity, DatabaseFailure>;
}

export interface Deletable {
  delete(id: Id): AsyncResult<void, DatabaseFailure>;
}

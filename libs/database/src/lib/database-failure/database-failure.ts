import { Failure } from '@wish-list/common-error';
import type { DomainFailure, Id } from '@wish-list/domain';

export type DatabaseFailureType = 'notFound' | 'constraint' | 'query' | 'mapping';
export type DatabaseFailure = Failure<DatabaseFailureType>;

export namespace DatabaseFailure {
  export function notFound(id: Id): Failure<'notFound'> {
    return Failure.create('notFound', 'Entity not found', { id });
  }

  export function constraint(source: Error): Failure<'constraint'> {
    return Failure.from(source, { driver: source.name }, 'constraint');
  }

  export function query(source: Error): Failure<'query'> {
    return Failure.from(source, { driver: source.name }, 'query');
  }

  export function mapping(source: DomainFailure): Failure<'mapping'> {
    return Failure.from(source, {}, 'mapping');
  }

  export function fromDriverError(error: unknown): DatabaseFailure {
    const source = error instanceof Error ? error : new Error(String(error));
    return isConstraintError(source) ? constraint(source) : query(source);
  }

  function isConstraintError(error: Error): boolean {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT');
  }
}

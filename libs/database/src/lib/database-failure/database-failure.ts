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
}

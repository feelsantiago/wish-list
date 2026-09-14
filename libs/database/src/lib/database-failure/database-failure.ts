import { Failure } from '@wish-list/common-error';
import type { DomainFailure } from '@wish-list/domain';

export type DatabaseFailureType = 'constraint' | 'query' | 'mapping';
export type DatabaseFailure = Failure<DatabaseFailureType>;

export namespace DatabaseFailure {
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

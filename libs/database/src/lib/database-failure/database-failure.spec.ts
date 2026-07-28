import { describe, it, expect } from 'vitest';
import { Failure } from '@wish-list/common-error';
import { Id, DomainFailure } from '@wish-list/domain';
import { DatabaseFailure } from './database-failure.js';

describe('DatabaseFailure.notFound', () => {
  it('returns Failure with name "notFound" and no source', () => {
    const id = Id.generate();
    const f = DatabaseFailure.notFound(id);
    expect(f).toBeInstanceOf(Failure);
    expect(f.name).toBe('notFound');
    expect(f.source).toBeUndefined();
    expect(f.metadata).toEqual({ id });
  });
});

describe('DatabaseFailure.constraint', () => {
  it('returns Failure with name "constraint", driver error as source', () => {
    const err = new Error('SQLITE_CONSTRAINT');
    const f = DatabaseFailure.constraint(err);
    expect(f.name).toBe('constraint');
    expect(f.source).toBe(err);
  });
});

describe('DatabaseFailure.query', () => {
  it('returns Failure with name "query", driver error as source', () => {
    const err = new Error('SQLITE_ERROR');
    const f = DatabaseFailure.query(err);
    expect(f.name).toBe('query');
    expect(f.source).toBe(err);
  });
});

describe('DatabaseFailure.mapping', () => {
  it('returns Failure with name "mapping", DomainFailure as source', () => {
    const domainFailure = DomainFailure.validation({}, []);
    const f = DatabaseFailure.mapping(domainFailure);
    expect(f.name).toBe('mapping');
    expect(f.source).toBe(domainFailure);
    expect(f.toString()).toContain('caused by:');
  });
});

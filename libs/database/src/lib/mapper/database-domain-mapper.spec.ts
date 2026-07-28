import { describe, it, expect } from 'vitest';
import { DomainFailure } from '@wish-list/domain';
import type { Id } from '@wish-list/domain';
import { DatabaseDomainMapper } from './database-domain-mapper.js';
import { DatabaseFailure } from '../database-failure/database-failure.js';

describe('DatabaseDomainMapper', () => {
  describe('domain (single row)', () => {
    it('passes through a successful fromRowFn as Ok', () => {
      const mapper = DatabaseDomainMapper.create(
        (value: number) => ({ value }),
        (row: { readonly value: number }) => row.value * 2,
      );
      const result = mapper.domain({ value: 21 });
      expect(result.unwrapOr(0)).toBe(42);
    });

    it('retags a thrown DomainFailure as DatabaseFailure "mapping"', () => {
      const mapper = DatabaseDomainMapper.create(
        (value: number) => ({ value }),
        (): number => {
          throw DomainFailure.validation({}, []);
        },
      );
      const result = mapper.domain({ value: 0 });
      result.match({
        ok: () => {
          throw new Error('expected err');
        },
        err: (failure) => {
          expect(failure.name).toBe('mapping');
          expect(failure.source).toBeInstanceOf(Error);
        },
      });
    });
  });

  describe('domain (undefined row)', () => {
    it('returns the supplied notFound failure when row is undefined', () => {
      const mapper = DatabaseDomainMapper.create(
        (value: number) => ({ value }),
        (row: { readonly value: number }) => row.value * 2,
      );
      const notFound = DatabaseFailure.notFound('missing-id' as Id);
      const result = mapper.domain(undefined, notFound);
      result.match({
        ok: () => {
          throw new Error('expected err');
        },
        err: (failure) => {
          expect(failure).toBe(notFound);
        },
      });
    });

    it('maps normally when row is defined, ignoring the notFound argument', () => {
      const mapper = DatabaseDomainMapper.create(
        (value: number) => ({ value }),
        (row: { readonly value: number }) => row.value * 2,
      );
      const notFound = DatabaseFailure.notFound('missing-id' as Id);
      const result = mapper.domain({ value: 21 }, notFound);
      expect(result.unwrapOr(0)).toBe(42);
    });
  });

  describe('domain (rows)', () => {
    it('maps every row to an entity when all succeed', () => {
      const mapper = DatabaseDomainMapper.create(
        (value: number) => ({ value }),
        (row: { readonly value: number }) => row.value * 2,
      );
      const result = mapper.domain([{ value: 1 }, { value: 2 }, { value: 3 }]);
      expect(result.unwrapOr([])).toEqual([2, 4, 6]);
    });

    it('short-circuits on the first row that fails mapping', () => {
      let calls = 0;
      const mapper = DatabaseDomainMapper.create(
        (value: number) => ({ value }),
        (row: { readonly value: number }) => {
          calls += 1;
          if (row.value === 2) throw DomainFailure.validation({}, []);
          return row.value * 2;
        },
      );
      const result = mapper.domain([{ value: 1 }, { value: 2 }, { value: 3 }]);
      expect(calls).toBe(2);
      result.match({
        ok: () => {
          throw new Error('expected err');
        },
        err: (failure) => {
          expect(failure.name).toBe('mapping');
        },
      });
    });
  });

  describe('database', () => {
    it('converts an entity to its row shape via toRowFn', () => {
      const mapper = DatabaseDomainMapper.create(
        (value: number) => ({ value }),
        (row: { readonly value: number }) => row.value,
      );
      expect(mapper.database(42)).toEqual({ value: 42 });
    });
  });
});

import { describe, it, expect } from 'vitest';
import { DomainFailure } from '@wish-list/domain';
import { wrap } from './repository.js';

describe('wrap', () => {
  it('passes through a successful fromFn as Ok', () => {
    const fromFn = wrap((row: { readonly value: number }) => row.value * 2);
    const result = fromFn({ value: 21 });
    expect(result.unwrapOr(0)).toBe(42);
  });

  it('retags a thrown DomainFailure as DatabaseFailure "mapping"', () => {
    const fromFn = wrap((): number => {
      throw DomainFailure.validation({}, []);
    });
    const result = fromFn({});
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

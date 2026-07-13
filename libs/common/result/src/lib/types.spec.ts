import { describe, it, expectTypeOf } from 'vitest';
import type { Result } from './result.js';
import type { ResultAsync } from './types.js';

describe('ResultAsync type alias', () => {
  it('is assignable from Promise<Result<T, E>>', () => {
    expectTypeOf<Promise<Result<number, string>>>().toExtend<
      ResultAsync<number, string>
    >();
  });

  it('is assignable to Promise<Result<T, E>>', () => {
    expectTypeOf<ResultAsync<number, string>>().toExtend<
      Promise<Result<number, string>>
    >();
  });
});

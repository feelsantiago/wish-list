import { expectTypeOf } from 'vitest';
import type { Brand, Unbrand } from './brand.js';

describe('Brand', () => {
  it('is assignable to base type', () => {
    type UserId = Brand<string, 'UserId'>;
    const id = 'abc' as UserId;
    expectTypeOf(id).toExtend<string>();
  });

  it('different brands are distinct', () => {
    type UserId = Brand<string, 'UserId'>;
    type PostId = Brand<string, 'PostId'>;
    expectTypeOf<UserId>().not.toEqualTypeOf<PostId>();
  });
});

describe('Unbrand', () => {
  it('strips brand', () => {
    type UserId = Brand<string, 'UserId'>;
    expectTypeOf<Unbrand<UserId>>().toEqualTypeOf<string>();
  });

  it('passes through non-branded', () => {
    expectTypeOf<Unbrand<string>>().toEqualTypeOf<string>();
    expectTypeOf<Unbrand<number>>().toEqualTypeOf<number>();
  });
});

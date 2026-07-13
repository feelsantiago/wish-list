import { expectTypeOf } from 'vitest';
import type { Option, Some, None } from '@wish-list/common-result';
import type { Brand } from '../brand/brand.js';
import type { Plain } from './plain.js';

describe('Plain', () => {
  it('maps Some to nullable value', () => {
    expectTypeOf<Plain<Some<string>>>().toEqualTypeOf<string | null>();
  });

  it('maps None to null', () => {
    expectTypeOf<Plain<None<string>>>().toEqualTypeOf<null>();
  });

  it('maps Option to nullable value', () => {
    expectTypeOf<Plain<Option<string>>>().toEqualTypeOf<string | null>();
  });

  it('maps Date to string', () => {
    expectTypeOf<Plain<Date>>().toEqualTypeOf<string>();
  });

  it('strips brand to base type', () => {
    type MyId = Brand<string, 'MyId'>;
    expectTypeOf<Plain<MyId>>().toEqualTypeOf<string>();
  });

  it('maps arrays recursively', () => {
    type MyId = Brand<string, 'MyId'>;
    expectTypeOf<Plain<ReadonlyArray<MyId>>>().toEqualTypeOf<string[]>();
  });

  it('maps objects recursively', () => {
    type MyId = Brand<string, 'MyId'>;
    type Entity = {
      readonly id: MyId;
      readonly createdAt: Date;
      readonly name: string;
    };
    expectTypeOf<Plain<Entity>>().toEqualTypeOf<{
      readonly id: string;
      readonly createdAt: string;
      readonly name: string;
    }>();
  });

  it('passes through primitives', () => {
    expectTypeOf<Plain<string>>().toEqualTypeOf<string>();
    expectTypeOf<Plain<number>>().toEqualTypeOf<number>();
    expectTypeOf<Plain<boolean>>().toEqualTypeOf<boolean>();
  });
});

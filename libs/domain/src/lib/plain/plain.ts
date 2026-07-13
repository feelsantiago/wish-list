import type { Some, None } from '@wish-list/common-result';
import type { Brand } from '../brand/brand.js';

export type Plain<T> =
  T extends Some<infer X>
    ? Plain<X> | null
    : T extends None<infer _>
      ? null
      : T extends Date
        ? string
        : T extends Brand<infer Base, string>
          ? Base
          : T extends ReadonlyArray<infer X>
            ? Plain<X>[]
            : T extends object
              ? { [K in keyof T]: Plain<T[K]> }
              : T;

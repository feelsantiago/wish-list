import { Ok, Err, type Result } from './result.js';

export class Some<T> {
  public readonly _tag = 'Some' as const;

  public constructor(public readonly value: T) {}

  public isSome(): this is Some<T> {
    return true;
  }

  public isNone(): this is None<T> {
    return false;
  }

  public map<U>(fn: (value: T) => U): Option<U> {
    return new Some(fn(this.value));
  }

  public andThen<U>(fn: (value: T) => Option<U>): Option<U> {
    return fn(this.value);
  }

  public filter(predicate: (value: T) => boolean): Option<T> {
    return predicate(this.value) ? this : (NONE as None<T>);
  }

  public match<U>(cases: { some: (value: T) => U; none: () => U }): U {
    return cases.some(this.value);
  }

  public unwrapOr(_defaultValue: T): T {
    return this.value;
  }

  public unwrapOrElse(_fn: () => T): T {
    return this.value;
  }

  public inspect(fn: (value: T) => void): Option<T> {
    fn(this.value);
    return this;
  }

  public okOr<E>(_error: E): Result<T, E> {
    return new Ok(this.value);
  }

  public okOrElse<E>(_fn: () => E): Result<T, E> {
    return new Ok(this.value);
  }
}

export class None<T = never> {
  public readonly _tag = 'None' as const;

  public isSome(): this is Some<T> {
    return false;
  }

  public isNone(): this is None<T> {
    return true;
  }

  public map<U>(_fn: (value: T) => U): Option<U> {
    return this as unknown as None<U>;
  }

  public andThen<U>(_fn: (value: T) => Option<U>): Option<U> {
    return this as unknown as None<U>;
  }

  public filter(_predicate: (value: T) => boolean): Option<T> {
    return this;
  }

  public match<U>(cases: { some: (value: T) => U; none: () => U }): U {
    return cases.none();
  }

  public unwrapOr(defaultValue: T): T {
    return defaultValue;
  }

  public unwrapOrElse(fn: () => T): T {
    return fn();
  }

  public inspect(_fn: (value: T) => void): Option<T> {
    return this;
  }

  public okOr<E>(error: E): Result<T, E> {
    return new Err(error) as unknown as Result<T, E>;
  }

  public okOrElse<E>(fn: () => E): Result<T, E> {
    return new Err(fn()) as unknown as Result<T, E>;
  }
}

const NONE = new None();

export type Option<T> = Some<T> | None<T>;

export namespace Option {
  export function some<T>(value: T): Some<T> {
    return new Some(value);
  }

  export function none<T = never>(): None<T> {
    return NONE as None<T>;
  }

  export function from<T>(value: T | null | undefined): Option<T> {
    return value == null ? (NONE as None<T>) : new Some(value);
  }

  export function fromThrowable<T>(fn: () => T): Option<T> {
    try {
      return new Some(fn());
    } catch {
      return NONE as None<T>;
    }
  }
}

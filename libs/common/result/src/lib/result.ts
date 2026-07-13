import { Option } from './option.js';

export class Ok<T, E = never> {
  public readonly _tag = 'Ok' as const;

  public constructor(public readonly value: T) {}

  public isOk(): this is Ok<T, E> {
    return true;
  }

  public isErr(): this is Err<T, E> {
    return false;
  }

  public map<U>(fn: (value: T) => U): Result<U, E> {
    return new Ok(fn(this.value));
  }

  public mapErr<F>(_fn: (error: E) => F): Result<T, F> {
    return this as unknown as Ok<T, F>;
  }

  public andThen<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }

  public match<U>(cases: { ok: (value: T) => U; err: (error: E) => U }): U {
    return cases.ok(this.value);
  }

  public unwrapOr(_defaultValue: T): T {
    return this.value;
  }

  public unwrapOrElse(_fn: (error: E) => T): T {
    return this.value;
  }

  public inspect(fn: (value: T) => void): Result<T, E> {
    fn(this.value);
    return this;
  }

  public inspectErr(_fn: (error: E) => void): Result<T, E> {
    return this;
  }

  public ok(): Option<T> {
    return Option.some(this.value);
  }

  public err(): Option<E> {
    return Option.none();
  }

  // eslint-disable-next-line require-yield -- terminal token for safeTry's generator-based composition, never actually iterated
  public *[Symbol.iterator](): Generator<Result<never, never>, T> {
    return this.value;
  }
}

export class Err<T = never, E = unknown> {
  public readonly _tag = 'Err' as const;

  public constructor(public readonly error: E) {}

  public isOk(): this is Ok<T, E> {
    return false;
  }

  public isErr(): this is Err<T, E> {
    return true;
  }

  public map<U>(_fn: (value: T) => U): Result<U, E> {
    return this as unknown as Err<U, E>;
  }

  public mapErr<F>(fn: (error: E) => F): Result<T, F> {
    return new Err(fn(this.error));
  }

  public andThen<U>(_fn: (value: T) => Result<U, E>): Result<U, E> {
    return this as unknown as Err<U, E>;
  }

  public match<U>(cases: { ok: (value: T) => U; err: (error: E) => U }): U {
    return cases.err(this.error);
  }

  public unwrapOr(defaultValue: T): T {
    return defaultValue;
  }

  public unwrapOrElse(fn: (error: E) => T): T {
    return fn(this.error);
  }

  public inspect(_fn: (value: T) => void): Result<T, E> {
    return this;
  }

  public inspectErr(fn: (error: E) => void): Result<T, E> {
    fn(this.error);
    return this;
  }

  public ok(): Option<T> {
    return Option.none();
  }

  public err(): Option<E> {
    return Option.some(this.error);
  }

  public *[Symbol.iterator](): Generator<Result<never, E>, never> {
    yield this as unknown as Result<never, E>;
    return undefined as never;
  }
}

export type Result<T, E> = Ok<T, E> | Err<T, E>;

function runSyncGenerator<T, E>(
  gen: Generator<Result<never, E>, Result<T, E>>,
): Result<T, E> {
  const next = gen.next();
  if (next.done) return next.value;
  const errResult = next.value as unknown as Result<T, E>;
  gen.return(errResult);
  return errResult;
}

async function runAsyncGenerator<T, E>(
  gen: AsyncGenerator<Result<never, E>, Result<T, E>>,
): Promise<Result<T, E>> {
  const next = await gen.next();
  if (next.done) return next.value;
  const errResult = next.value as unknown as Result<T, E>;
  await gen.return(errResult);
  return errResult;
}

export namespace Result {
  export function ok<T>(value: T): Ok<T, never> {
    return new Ok(value);
  }

  export function err<E>(error: E): Err<never, E> {
    return new Err(error);
  }

  export function fromThrowable<T, E = unknown>(
    fn: () => T,
    mapErr?: (error: unknown) => E,
  ): Result<T, E> {
    try {
      return new Ok(fn());
    } catch (error) {
      return new Err(mapErr ? mapErr(error) : (error as E));
    }
  }

  export function safeTry<T, E>(
    body: () => Generator<Result<never, E>, Result<T, E>>,
  ): Result<T, E>;
  export function safeTry<T, E>(
    body: () => AsyncGenerator<Result<never, E>, Result<T, E>>,
  ): Promise<Result<T, E>>;
  export function safeTry<C, T, E>(
    context: C,
    body: (this: C) => Generator<Result<never, E>, Result<T, E>>,
  ): Result<T, E>;
  export function safeTry<C, T, E>(
    context: C,
    body: (this: C) => AsyncGenerator<Result<never, E>, Result<T, E>>,
  ): Promise<Result<T, E>>;
  export function safeTry(...args: unknown[]): unknown {
    const gen =
      args.length === 1
        ? (args[0] as () => unknown)()
        : (args[1] as (this: unknown) => unknown).call(args[0]);

    if (gen != null && typeof gen === 'object' && Symbol.asyncIterator in gen) {
      return runAsyncGenerator(
        gen as AsyncGenerator<Result<never, unknown>, Result<unknown, unknown>>,
      );
    }
    return runSyncGenerator(
      gen as Generator<Result<never, unknown>, Result<unknown, unknown>>,
    );
  }
}

export function ok<T>(value: T): Ok<T, never> {
  return new Ok(value);
}

export function err<E>(error: E): Err<never, E> {
  return new Err(error);
}

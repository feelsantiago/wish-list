import { Result } from './result.js';

export class AsyncResult<T, E> {
  public constructor(private readonly promise: Promise<Result<T, E>>) {}

  public async *[Symbol.asyncIterator](): AsyncGenerator<
    Result<never, E>,
    T
  > {
    const result = await this.promise;
    return yield* result;
  }

  public map<U>(fn: (value: T) => U): AsyncResult<U, E> {
    return new AsyncResult(this.promise.then((r) => r.map(fn)));
  }

  public mapErr<F>(fn: (error: E) => F): AsyncResult<T, F> {
    return new AsyncResult(this.promise.then((r) => r.mapErr(fn)));
  }

  public andThen<U>(
    fn: (value: T) => Result<U, E> | AsyncResult<U, E>,
  ): AsyncResult<U, E> {
    return new AsyncResult(
      this.promise.then((result) => {
        if (result.isErr()) return result as unknown as Result<U, E>;
        const next = fn(result.value);
        return next instanceof AsyncResult ? next.toPromise() : next;
      }),
    );
  }

  public match<U>(cases: {
    ok: (value: T) => U;
    err: (error: E) => U;
  }): Promise<U> {
    return this.promise.then((r) => r.match(cases));
  }

  public unwrapOr(defaultValue: T): Promise<T> {
    return this.promise.then((r) => r.unwrapOr(defaultValue));
  }

  public inspect(fn: (value: T) => void): AsyncResult<T, E> {
    return new AsyncResult(this.promise.then((r) => r.inspect(fn)));
  }

  public inspectErr(fn: (error: E) => void): AsyncResult<T, E> {
    return new AsyncResult(this.promise.then((r) => r.inspectErr(fn)));
  }

  public toPromise(): Promise<Result<T, E>> {
    return this.promise;
  }

  public static fromThrowable<T, E = unknown>(
    fn: () => Promise<T>,
    mapErr?: (error: unknown) => E,
  ): AsyncResult<T, E> {
    let promise: Promise<T>;
    try {
      promise = fn();
    } catch (error) {
      return new AsyncResult(
        Promise.resolve(
          Result.err(mapErr ? mapErr(error) : (error as E)) as Result<T, E>,
        ),
      );
    }
    return new AsyncResult(
      promise.then(
        (value) => Result.ok(value) as Result<T, E>,
        (error: unknown) =>
          Result.err(mapErr ? mapErr(error) : (error as E)) as Result<T, E>,
      ),
    );
  }

  public static fromPromise<T, E = unknown>(
    promise: Promise<T>,
    mapErr?: (error: unknown) => E,
  ): AsyncResult<T, E> {
    return new AsyncResult(
      promise.then(
        (value) => Result.ok(value) as Result<T, E>,
        (error: unknown) =>
          Result.err(
            mapErr ? mapErr(error) : (error as unknown as E),
          ) as Result<T, E>,
      ),
    );
  }

  public static fromResult<T, E>(result: Result<T, E>): AsyncResult<T, E> {
    return new AsyncResult(Promise.resolve(result));
  }
}

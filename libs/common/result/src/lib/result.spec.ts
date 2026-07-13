import { describe, it, expect, vi } from 'vitest';
import { Ok, Err, Result, ok, err } from './result.js';

describe('Ok', () => {
  it('constructs with a value', () => {
    const result = new Ok(42);
    expect(result.value).toBe(42);
    expect(result._tag).toBe('Ok');
  });

  it('isOk returns true', () => {
    const result: Result<number, string> = new Ok(1);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(1);
    }
  });

  it('isErr returns false', () => {
    const result: Result<number, string> = new Ok(1);
    expect(result.isErr()).toBe(false);
  });

  it('map transforms the value', () => {
    const result = new Ok(2).map((v) => v * 3);
    expect(result).toEqual(new Ok(6));
  });

  it('mapErr is a no-op', () => {
    const result: Result<number, string> = new Ok(5);
    const mapped = result.mapErr(() => 'changed');
    expect(mapped.isOk()).toBe(true);
    expect((mapped as Ok<number, string>).value).toBe(5);
  });

  it('andThen chains to the next result', () => {
    const result = new Ok<number, string>(10).andThen((v) =>
      v > 5 ? Result.ok(v.toString()) : Result.err('too small'),
    );
    expect(result).toEqual(new Ok('10'));
  });

  it('match calls the ok branch', () => {
    const result: Result<number, string> = new Ok(7);
    const output = result.match({
      ok: (v) => `value: ${v}`,
      err: (e) => `error: ${e}`,
    });
    expect(output).toBe('value: 7');
  });

  it('unwrapOr returns the value', () => {
    const result: Result<number, string> = new Ok(42);
    expect(result.unwrapOr(0)).toBe(42);
  });

  it('unwrapOrElse returns the value', () => {
    const result: Result<number, string> = new Ok(42);
    expect(result.unwrapOrElse(() => 0)).toBe(42);
  });

  it('inspect calls fn with the value', () => {
    const spy = vi.fn();
    const result: Result<number, string> = new Ok(3);
    const returned = result.inspect(spy);
    expect(spy).toHaveBeenCalledWith(3);
    expect(returned).toBe(result);
  });

  it('inspectErr does not call fn', () => {
    const spy = vi.fn();
    const result: Result<number, string> = new Ok(3);
    result.inspectErr(spy);
    expect(spy).not.toHaveBeenCalled();
  });

  it('ok() returns Some of the value', () => {
    const opt = new Ok(5).ok();
    expect(opt.isSome()).toBe(true);
    expect(opt.unwrapOr(0)).toBe(5);
  });

  it('err() returns None', () => {
    const opt = new Ok<number, string>(5).err();
    expect(opt.isNone()).toBe(true);
  });
});

describe('Err', () => {
  it('constructs with an error', () => {
    const result = new Err('fail');
    expect(result.error).toBe('fail');
    expect(result._tag).toBe('Err');
  });

  it('isOk returns false', () => {
    const result: Result<number, string> = new Err('fail');
    expect(result.isOk()).toBe(false);
  });

  it('isErr returns true', () => {
    const result: Result<number, string> = new Err('fail');
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe('fail');
    }
  });

  it('map is a no-op', () => {
    const result: Result<number, string> = new Err('fail');
    const mapped = result.map((v) => v * 2);
    expect(mapped.isErr()).toBe(true);
  });

  it('mapErr transforms the error', () => {
    const result: Result<number, string> = new Err('fail');
    const mapped = result.mapErr((e) => e.toUpperCase());
    expect(mapped.isErr()).toBe(true);
    expect((mapped as Err<number, string>).error).toBe('FAIL');
  });

  it('andThen is a no-op', () => {
    const result: Result<number, string> = new Err('fail');
    const chained = result.andThen((v) => Result.ok(v * 2));
    expect(chained.isErr()).toBe(true);
  });

  it('match calls the err branch', () => {
    const result: Result<number, string> = new Err('fail');
    const output = result.match({
      ok: (v) => `value: ${v}`,
      err: (e) => `error: ${e}`,
    });
    expect(output).toBe('error: fail');
  });

  it('unwrapOr returns the default', () => {
    const result: Result<number, string> = new Err('fail');
    expect(result.unwrapOr(99)).toBe(99);
  });

  it('unwrapOrElse calls the fn with the error', () => {
    const result: Result<number, string> = new Err('fail');
    expect(result.unwrapOrElse((e) => e.length)).toBe(4);
  });

  it('inspect does not call fn', () => {
    const spy = vi.fn();
    const result: Result<number, string> = new Err('fail');
    result.inspect(spy);
    expect(spy).not.toHaveBeenCalled();
  });

  it('inspectErr calls fn with the error', () => {
    const spy = vi.fn();
    const result: Result<number, string> = new Err('fail');
    const returned = result.inspectErr(spy);
    expect(spy).toHaveBeenCalledWith('fail');
    expect(returned).toBe(result);
  });

  it('ok() returns None', () => {
    const opt = new Err<number, string>('fail').ok();
    expect(opt.isNone()).toBe(true);
  });

  it('err() returns Some of the error', () => {
    const opt = new Err('fail').err();
    expect(opt.isSome()).toBe(true);
    expect(opt.unwrapOr('')).toBe('fail');
  });
});

describe('Result namespace', () => {
  it('ok creates an Ok', () => {
    const result = Result.ok(42);
    expect(result).toBeInstanceOf(Ok);
    expect(result.value).toBe(42);
  });

  it('err creates an Err', () => {
    const result = Result.err('fail');
    expect(result).toBeInstanceOf(Err);
    expect(result.error).toBe('fail');
  });

  describe('fromThrowable', () => {
    it('returns Ok when fn succeeds', () => {
      const result = Result.fromThrowable(
        () => JSON.parse('{"a":1}'),
        (e) => String(e),
      );
      expect(result.isOk()).toBe(true);
      expect(result.unwrapOr(null)).toEqual({ a: 1 });
    });

    it('returns Err when fn throws', () => {
      const result = Result.fromThrowable(
        () => JSON.parse('invalid'),
        (e) => (e instanceof Error ? e.message : String(e)),
      );
      expect(result.isErr()).toBe(true);
    });

    it('returns Ok without mapErr when fn succeeds', () => {
      const result = Result.fromThrowable(() => 42);
      expect(result.isOk()).toBe(true);
      expect(result.unwrapOr(0)).toBe(42);
    });

    it('returns Err without mapErr when fn throws, preserving raw error', () => {
      const thrown = new Error('raw');
      const result = Result.fromThrowable(() => {
        throw thrown;
      });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBe(thrown);
      }
    });
  });

  describe('safeTry', () => {
    it('returns Ok when all steps succeed (sync)', () => {
      const result = Result.safeTry(function* () {
        const a = yield* ok(10);
        const b = yield* ok(20);
        return ok(a + b);
      });
      expect(result).toEqual(Result.ok(30));
    });

    it('short-circuits on first Err (sync)', () => {
      const result = Result.safeTry(function* () {
        yield* ok(10);
        yield* err('fail' as const);
        return ok(0);
      });
      expect(result).toEqual(Result.err('fail'));
    });

    it('returns Ok when all steps succeed (async)', async () => {
      const result = await Result.safeTry(async function* () {
        const a = yield* ok(10);
        const b = yield* ok(20);
        return ok(a + b);
      });
      expect(result).toEqual(Result.ok(30));
    });

    it('short-circuits on first Err (async)', async () => {
      const result = await Result.safeTry(async function* () {
        yield* err('fail' as const);
        return ok(0);
      });
      expect(result).toEqual(Result.err('fail'));
    });

    it('supports this-binding (sync)', () => {
      const ctx = { multiplier: 3 };
      const result = Result.safeTry(ctx, function* (this: typeof ctx) {
        const a = yield* ok(10);
        return ok(a * this.multiplier);
      });
      expect(result).toEqual(Result.ok(30));
    });

    it('supports this-binding (async)', async () => {
      const ctx = { multiplier: 5 };
      const result = await Result.safeTry(
        ctx,
        async function* (this: typeof ctx) {
          const a = yield* ok(4);
          return ok(a * this.multiplier);
        },
      );
      expect(result).toEqual(Result.ok(20));
    });
  });
});

describe('standalone ok/err', () => {
  it('ok creates an Ok', () => {
    expect(ok(1)).toBeInstanceOf(Ok);
  });

  it('err creates an Err', () => {
    expect(err('x')).toBeInstanceOf(Err);
  });
});

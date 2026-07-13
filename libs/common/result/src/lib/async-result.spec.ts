import { describe, it, expect, vi } from 'vitest';
import { AsyncResult } from './async-result.js';
import { Ok, Err, Result } from './result.js';

describe('AsyncResult', () => {
  describe('static factories', () => {
    it('fromThrowable returns Ok on success', async () => {
      const ar = AsyncResult.fromThrowable(() => Promise.resolve(42), String);
      const result = await ar.toPromise();
      expect(result).toEqual(Result.ok(42));
    });

    it('fromThrowable returns Err on rejection', async () => {
      const ar = AsyncResult.fromThrowable(
        () => Promise.reject(new Error('boom')),
        (e) => (e instanceof Error ? e.message : String(e)),
      );
      const result = await ar.toPromise();
      expect(result.isErr()).toBe(true);
      expect((result as Err<number, string>).error).toBe('boom');
    });

    it('fromThrowable returns Err when fn throws synchronously', async () => {
      const ar = AsyncResult.fromThrowable(
        () => {
          throw new Error('sync boom');
        },
        (e) => (e instanceof Error ? e.message : String(e)),
      );
      const result = await ar.toPromise();
      expect(result.isErr()).toBe(true);
    });

    it('fromPromise wraps a resolved promise', async () => {
      const ar = AsyncResult.fromPromise(Promise.resolve(10), String);
      const result = await ar.toPromise();
      expect(result).toEqual(Result.ok(10));
    });

    it('fromPromise wraps a rejected promise', async () => {
      const ar = AsyncResult.fromPromise(
        Promise.reject(new Error('fail')),
        (e) => (e instanceof Error ? e.message : String(e)),
      );
      const result = await ar.toPromise();
      expect(result.isErr()).toBe(true);
    });

    it('fromResult wraps a sync Result', async () => {
      const ar = AsyncResult.fromResult(Result.ok(5));
      const result = await ar.toPromise();
      expect(result).toEqual(Result.ok(5));
    });

    it('fromThrowable returns Ok without mapErr on success', async () => {
      const ar = AsyncResult.fromThrowable(() => Promise.resolve(99));
      const result = await ar.toPromise();
      expect(result).toEqual(Result.ok(99));
    });

    it('fromThrowable returns Err without mapErr on rejection, preserving raw error', async () => {
      const thrown = new Error('raw async');
      const ar = AsyncResult.fromThrowable(() => Promise.reject(thrown));
      const result = await ar.toPromise();
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBe(thrown);
      }
    });

    it('fromThrowable returns Err without mapErr on sync throw, preserving raw error', async () => {
      const thrown = new Error('sync raw');
      const ar = AsyncResult.fromThrowable(() => {
        throw thrown;
      });
      const result = await ar.toPromise();
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBe(thrown);
      }
    });

    it('fromPromise returns Ok without mapErr on resolution', async () => {
      const ar = AsyncResult.fromPromise(Promise.resolve(7));
      const result = await ar.toPromise();
      expect(result).toEqual(Result.ok(7));
    });

    it('fromPromise returns Err without mapErr on rejection, preserving raw error', async () => {
      const thrown = new Error('promise raw');
      const ar = AsyncResult.fromPromise(Promise.reject(thrown));
      const result = await ar.toPromise();
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBe(thrown);
      }
    });
  });

  describe('instance methods', () => {
    it('map transforms the value', async () => {
      const result = await AsyncResult.fromResult(Result.ok(3))
        .map((v) => v * 2)
        .toPromise();
      expect(result).toEqual(Result.ok(6));
    });

    it('map is a no-op on Err', async () => {
      const result = await AsyncResult.fromResult<number, string>(
        Result.err('fail'),
      )
        .map((v) => v * 2)
        .toPromise();
      expect(result.isErr()).toBe(true);
    });

    it('mapErr transforms the error', async () => {
      const result = await AsyncResult.fromResult<number, string>(
        Result.err('fail'),
      )
        .mapErr((e) => e.toUpperCase())
        .toPromise();
      expect(result.isErr()).toBe(true);
      expect((result as Err<number, string>).error).toBe('FAIL');
    });

    it('mapErr is a no-op on Ok', async () => {
      const result = await AsyncResult.fromResult<number, string>(Result.ok(5))
        .mapErr((e) => e.toUpperCase())
        .toPromise();
      expect(result).toEqual(Result.ok(5));
    });

    it('andThen chains with sync Result', async () => {
      const result = await AsyncResult.fromResult<number, string>(Result.ok(10))
        .andThen((v) => (v > 5 ? Result.ok(v * 2) : Result.err('too small')))
        .toPromise();
      expect(result).toEqual(Result.ok(20));
    });

    it('andThen chains with AsyncResult', async () => {
      const result = await AsyncResult.fromResult(Result.ok(10))
        .andThen((v) => AsyncResult.fromResult(Result.ok(v + 1)))
        .toPromise();
      expect(result).toEqual(Result.ok(11));
    });

    it('andThen short-circuits on Err', async () => {
      const result = await AsyncResult.fromResult<number, string>(
        Result.err('fail'),
      )
        .andThen((v) => Result.ok(v * 2))
        .toPromise();
      expect(result.isErr()).toBe(true);
    });

    it('match dispatches to ok branch', async () => {
      const output = await AsyncResult.fromResult(Result.ok(7)).match({
        ok: (v) => `value: ${v}`,
        err: (e) => `error: ${e}`,
      });
      expect(output).toBe('value: 7');
    });

    it('match dispatches to err branch', async () => {
      const output = await AsyncResult.fromResult<number, string>(
        Result.err('fail'),
      ).match({
        ok: (v) => `value: ${v}`,
        err: (e) => `error: ${e}`,
      });
      expect(output).toBe('error: fail');
    });

    it('unwrapOr returns the value on Ok', async () => {
      const value = await AsyncResult.fromResult(Result.ok(42)).unwrapOr(0);
      expect(value).toBe(42);
    });

    it('unwrapOr returns the default on Err', async () => {
      const value = await AsyncResult.fromResult<number, string>(
        Result.err('fail'),
      ).unwrapOr(0);
      expect(value).toBe(0);
    });

    it('inspect calls fn on Ok', async () => {
      const spy = vi.fn();
      await AsyncResult.fromResult(Result.ok(3)).inspect(spy).toPromise();
      expect(spy).toHaveBeenCalledWith(3);
    });

    it('inspect does not call fn on Err', async () => {
      const spy = vi.fn();
      await AsyncResult.fromResult<number, string>(Result.err('fail'))
        .inspect(spy)
        .toPromise();
      expect(spy).not.toHaveBeenCalled();
    });

    it('inspectErr calls fn on Err', async () => {
      const spy = vi.fn();
      await AsyncResult.fromResult<number, string>(Result.err('fail'))
        .inspectErr(spy)
        .toPromise();
      expect(spy).toHaveBeenCalledWith('fail');
    });

    it('inspectErr does not call fn on Ok', async () => {
      const spy = vi.fn();
      await AsyncResult.fromResult(Result.ok(3)).inspectErr(spy).toPromise();
      expect(spy).not.toHaveBeenCalled();
    });

    it('toPromise returns the inner promise', async () => {
      const okResult: Result<number, string> = new Ok(42);
      const ar = AsyncResult.fromResult(okResult);
      const result = await ar.toPromise();
      expect(result).toEqual(new Ok(42));
    });

    it('chains multiple operations fluently', async () => {
      const result = await AsyncResult.fromPromise(Promise.resolve(10), String)
        .map((v) => v * 2)
        .andThen((v) => (v > 15 ? Result.ok(v) : Result.err('too small')))
        .mapErr((e) => `Error: ${e}`)
        .toPromise();
      expect(result).toEqual(Result.ok(20));
    });
  });
});

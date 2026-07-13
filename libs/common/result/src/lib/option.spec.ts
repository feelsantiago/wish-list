import { describe, it, expect, vi } from 'vitest';
import { Some, None, Option } from './option.js';

describe('Some', () => {
  it('constructs with a value', () => {
    const opt = new Some(42);
    expect(opt.value).toBe(42);
    expect(opt._tag).toBe('Some');
  });

  it('isSome returns true', () => {
    const opt: Option<number> = new Some(1);
    expect(opt.isSome()).toBe(true);
  });

  it('isNone returns false', () => {
    const opt: Option<number> = new Some(1);
    expect(opt.isNone()).toBe(false);
  });

  it('map transforms the value', () => {
    const opt = new Some(3).map((v) => v * 2);
    expect(opt).toEqual(new Some(6));
  });

  it('andThen chains to next option', () => {
    const opt = new Some(5).andThen((v) =>
      v > 3 ? Option.some(v.toString()) : Option.none(),
    );
    expect(opt).toEqual(new Some('5'));
  });

  it('filter keeps value when predicate passes', () => {
    const opt: Option<number> = new Some(10);
    const filtered = opt.filter((v) => v > 5);
    expect(filtered.isSome()).toBe(true);
  });

  it('filter returns None when predicate fails', () => {
    const opt: Option<number> = new Some(2);
    const filtered = opt.filter((v) => v > 5);
    expect(filtered.isNone()).toBe(true);
  });

  it('match calls the some branch', () => {
    const opt: Option<number> = new Some(7);
    const output = opt.match({
      some: (v) => `value: ${v}`,
      none: () => 'nothing',
    });
    expect(output).toBe('value: 7');
  });

  it('unwrapOr returns the value', () => {
    const opt: Option<number> = new Some(42);
    expect(opt.unwrapOr(0)).toBe(42);
  });

  it('unwrapOrElse returns the value', () => {
    const opt: Option<number> = new Some(42);
    expect(opt.unwrapOrElse(() => 0)).toBe(42);
  });

  it('inspect calls fn with the value', () => {
    const spy = vi.fn();
    const opt: Option<number> = new Some(3);
    const returned = opt.inspect(spy);
    expect(spy).toHaveBeenCalledWith(3);
    expect(returned).toBe(opt);
  });

  it('okOr returns Ok with the value', () => {
    const result = new Some(5).okOr('err');
    expect(result.isOk()).toBe(true);
    expect(result.unwrapOr(0)).toBe(5);
  });

  it('okOrElse returns Ok with the value', () => {
    const result = new Some(5).okOrElse(() => 'err');
    expect(result.isOk()).toBe(true);
    expect(result.unwrapOr(0)).toBe(5);
  });
});

describe('None', () => {
  it('has the correct tag', () => {
    const opt = new None();
    expect(opt._tag).toBe('None');
  });

  it('isSome returns false', () => {
    const opt: Option<number> = Option.none();
    expect(opt.isSome()).toBe(false);
  });

  it('isNone returns true', () => {
    const opt: Option<number> = Option.none();
    expect(opt.isNone()).toBe(true);
  });

  it('map returns None', () => {
    const opt: Option<number> = Option.none();
    const mapped = opt.map((v) => v * 2);
    expect(mapped.isNone()).toBe(true);
  });

  it('andThen returns None', () => {
    const opt: Option<number> = Option.none();
    const chained = opt.andThen((v) => Option.some(v.toString()));
    expect(chained.isNone()).toBe(true);
  });

  it('filter returns None', () => {
    const opt: Option<number> = Option.none();
    const filtered = opt.filter(() => true);
    expect(filtered.isNone()).toBe(true);
  });

  it('match calls the none branch', () => {
    const opt: Option<number> = Option.none();
    const output = opt.match({
      some: (v) => `value: ${v}`,
      none: () => 'nothing',
    });
    expect(output).toBe('nothing');
  });

  it('unwrapOr returns the default', () => {
    const opt: Option<number> = Option.none();
    expect(opt.unwrapOr(99)).toBe(99);
  });

  it('unwrapOrElse calls the fn', () => {
    const opt: Option<number> = Option.none();
    expect(opt.unwrapOrElse(() => 99)).toBe(99);
  });

  it('inspect does not call fn', () => {
    const spy = vi.fn();
    const opt: Option<number> = Option.none();
    opt.inspect(spy);
    expect(spy).not.toHaveBeenCalled();
  });

  it('okOr returns Err with the provided error', () => {
    const opt: Option<number> = Option.none();
    const result = opt.okOr('missing');
    expect(result.isErr()).toBe(true);
  });

  it('okOrElse returns Err with the computed error', () => {
    const opt: Option<number> = Option.none();
    const result = opt.okOrElse(() => 'missing');
    expect(result.isErr()).toBe(true);
  });
});

describe('Option namespace', () => {
  it('some creates a Some', () => {
    const opt = Option.some(42);
    expect(opt).toBeInstanceOf(Some);
    expect(opt.value).toBe(42);
  });

  it('none creates a None', () => {
    const opt = Option.none();
    expect(opt).toBeInstanceOf(None);
  });

  it('none returns singleton', () => {
    expect(Option.none()).toBe(Option.none());
  });

  describe('from', () => {
    it('returns Some for non-null values', () => {
      expect(Option.from(42).isSome()).toBe(true);
      expect(Option.from('').isSome()).toBe(true);
      expect(Option.from(0).isSome()).toBe(true);
      expect(Option.from(false).isSome()).toBe(true);
    });

    it('returns None for null', () => {
      expect(Option.from(null).isNone()).toBe(true);
    });

    it('returns None for undefined', () => {
      expect(Option.from(undefined).isNone()).toBe(true);
    });
  });

  describe('fromThrowable', () => {
    it('returns Some when fn succeeds', () => {
      const opt = Option.fromThrowable(() => 42);
      expect(opt.isSome()).toBe(true);
      expect(opt.unwrapOr(0)).toBe(42);
    });

    it('returns None when fn throws', () => {
      const opt = Option.fromThrowable(() => {
        throw new Error('boom');
      });
      expect(opt.isNone()).toBe(true);
    });
  });
});

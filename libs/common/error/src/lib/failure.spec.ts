import { describe, it, expect } from 'vitest';
import { Failure } from './failure.js';

describe('Failure.from', () => {
  it('creates from string with default name', () => {
    const f = Failure.from('something went wrong');
    expect(f.name).toBe('Failure');
    expect(f.message).toBe('something went wrong');
    expect(f.source).toBeUndefined();
    expect(f.stack).toBeTruthy();
  });

  it('creates from string with metadata', () => {
    const f = Failure.from('oops', { code: 42 });
    expect(f.metadata).toEqual({ code: 42 });
  });

  it('creates from Error, copies message, sets source', () => {
    const err = new Error('native error');
    const f = Failure.from(err);
    expect(f.message).toBe('native error');
    expect(f.source).toBe(err);
    expect(f.metadata).toEqual({});
  });

  it('creates from Error with metadata', () => {
    const err = new Error('boom');
    const f = Failure.from(err, { context: 'test' });
    expect(f.metadata).toEqual({ context: 'test' });
  });

  it('creates from Error with target name, keeps Error as source', () => {
    const err = new Error('SQLITE_CONSTRAINT');
    const f = Failure.from(err, { driver: err.name }, 'constraint');
    expect(f.name).toBe('constraint');
    expect(f.source).toBe(err);
    expect(f.metadata).toEqual({ driver: err.name });
  });

  it('creates from unknown by stringifying', () => {
    const f = Failure.from(123);
    expect(f.message).toBe('123');
  });

  it('returns same instance for Failure with no metadata', () => {
    const original = Failure.from('error');
    const result = Failure.from(original);
    expect(result).toBe(original);
  });

  it('wraps Failure with explicit generic, old becomes source', () => {
    const original = Failure.from('original error');
    const wrapped = Failure.from<'WrappedFailure'>(original, { extra: 'data' });
    expect(wrapped).not.toBe(original);
    expect(wrapped.source).toBe(original);
    expect(wrapped.metadata).toEqual({ extra: 'data' });
  });

  it('overrides name when target name given, keeps source chain', () => {
    const original = Failure.create('validation', 'invalid input');
    const wrapped = Failure.from(original, { entity: 'User' }, 'mapping');
    expect(wrapped.name).toBe('mapping');
    expect(wrapped.source).toBe(original);
    expect(wrapped.toString()).toContain('caused by:');
  });

  it('overrides name even with empty metadata', () => {
    const original = Failure.create('validation', 'invalid input');
    const wrapped = Failure.from(original, {}, 'mapping');
    expect(wrapped.name).toBe('mapping');
    expect(wrapped).not.toBe(original);
  });
});

describe('Failure.create', () => {
  it('creates with typed name', () => {
    const f = Failure.create('validation', 'Validation failed');
    expect(f.name).toBe('validation');
    expect(f.message).toBe('Validation failed');
  });

  it('creates with metadata', () => {
    const f = Failure.create('validation', 'Validation failed', {
      field: 'email',
    });
    expect(f.metadata).toEqual({ field: 'email' });
  });

  it('source is undefined', () => {
    const f = Failure.create('validation', 'Validation failed');
    expect(f.source).toBeUndefined();
  });

  it('captures stack trace', () => {
    const f = Failure.create('validation', 'Validation failed');
    expect(f.stack).toBeTruthy();
  });

  it('formats with typed name in toString', () => {
    const f = Failure.create('validation', 'Validation failed');
    expect(f.toString()).toContain('[validation] Validation failed');
  });
});

describe('Failure.context', () => {
  it('creates new Failure with original as source', () => {
    const original = Failure.from('root cause');
    const ctx = original.context('higher level message');
    expect(ctx).not.toBe(original);
    expect(ctx.source).toBe(original);
    expect(ctx.message).toBe('higher level message');
    expect(ctx.stack).toBeTruthy();
  });

  it('inherits name from source by default', () => {
    const original = Failure.from('root');
    const ctx = original.context('wrapper');
    expect(ctx.name).toBe(original.name);
  });

  it('attaches metadata only on new layer', () => {
    const original = Failure.from('root', { rootKey: 'rootVal' });
    const ctx = original.context('wrapper', { ctxKey: 'ctxVal' });
    expect(ctx.metadata).toEqual({ ctxKey: 'ctxVal' });
    expect(original.metadata).toEqual({ rootKey: 'rootVal' });
  });
});

describe('Failure.withMetadata', () => {
  it('shallow merges metadata', () => {
    const original = Failure.from('error', { a: 1 });
    const updated = original.withMetadata({ b: 2 });
    expect(updated.metadata).toEqual({ a: 1, b: 2 });
  });

  it('later keys win in merge', () => {
    const original = Failure.from('error', { a: 1 });
    const updated = original.withMetadata({ a: 99 });
    expect(updated.metadata).toEqual({ a: 99 });
  });

  it('preserves source', () => {
    const err = new Error('native');
    const f = Failure.from(err);
    const updated = f.withMetadata({ extra: true });
    expect(updated.source).toBe(err);
  });
});

describe('Failure immutability', () => {
  it('original unchanged after context', () => {
    const original = Failure.from('root', { key: 'val' });
    original.context('wrapper', { other: 'data' });
    expect(original.message).toBe('root');
    expect(original.metadata).toEqual({ key: 'val' });
    expect(original.source).toBeUndefined();
  });

  it('original unchanged after withMetadata', () => {
    const original = Failure.from('root', { a: 1 });
    original.withMetadata({ b: 2 });
    expect(original.metadata).toEqual({ a: 1 });
  });
});

describe('Failure stack', () => {
  it('from() captures stack', () => {
    const f = Failure.from('error');
    expect(f.stack).toBeTruthy();
  });

  it('context() captures stack', () => {
    const original = Failure.from('root');
    const ctx = original.context('wrapper');
    expect(ctx.stack).toBeTruthy();
  });

  it('withMetadata() preserves source stack, no new capture', () => {
    const original = Failure.from('error');
    const updated = original.withMetadata({ x: 1 });
    expect(updated.stack).toBeTruthy();
  });
});

describe('Failure.toString', () => {
  it('formats single failure', () => {
    const f = Failure.from('something failed', { key: 'value' });
    const str = f.toString();
    expect(str).toContain('[Failure] something failed');
    expect(str).toContain('key: value');
  });

  it('formats chain with Failure source', () => {
    const root = Failure.from('root cause');
    const ctx = root.context('outer message');
    const str = ctx.toString();
    expect(str).toContain('[Failure] outer message');
    expect(str).toContain('caused by:');
    expect(str).toContain('[Failure] root cause');
  });

  it('formats chain with Error source', () => {
    const err = new Error('native error');
    const f = Failure.from(err);
    const ctx = f.context('wrapped');
    const str = ctx.toString();
    expect(str).toContain('[Error] native error');
  });
});

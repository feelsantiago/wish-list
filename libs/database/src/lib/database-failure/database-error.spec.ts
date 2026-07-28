import { describe, it, expect } from 'vitest';
import { DatabaseError } from './database-error.js';

describe('DatabaseError.from', () => {
  it('classifies SQLITE_CONSTRAINT codes as a constraint failure', () => {
    const err = Object.assign(new Error('UNIQUE constraint failed'), {
      code: 'SQLITE_CONSTRAINT_UNIQUE',
    });
    const failure = DatabaseError.from(err).failure();
    expect(failure.name).toBe('constraint');
    expect(failure.source).toBe(err);
  });

  it('classifies other error codes as a query failure', () => {
    const err = Object.assign(new Error('disk I/O error'), {
      code: 'SQLITE_IOERR',
    });
    const failure = DatabaseError.from(err).failure();
    expect(failure.name).toBe('query');
    expect(failure.source).toBe(err);
  });

  it('wraps non-Error values as a query failure', () => {
    const failure = DatabaseError.from('boom').failure();
    expect(failure.name).toBe('query');
    expect(failure.source).toBeInstanceOf(Error);
    expect((failure.source as Error).message).toBe('boom');
  });
});

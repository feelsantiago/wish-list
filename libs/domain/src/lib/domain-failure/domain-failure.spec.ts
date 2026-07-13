import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Failure } from '@wish-list/common-error';
import { DomainFailure } from './domain-failure.js';

const schema = z.object({ email: z.string().email() });

function zodError(input: unknown) {
  try {
    schema.parse(input);
    throw new Error('expected parse to fail');
  } catch (e) {
    return e as import('zod').ZodError;
  }
}

describe('DomainFailure.validation', () => {
  it('returns Failure with name "validation"', () => {
    const err = zodError({ email: 'bad' });
    const f = DomainFailure.validation({ email: 'bad' }, err);
    expect(f).toBeInstanceOf(Failure);
    expect(f.name).toBe('validation');
  });

  it('metadata has input and issues keys', () => {
    const input = { email: 'bad' };
    const err = zodError(input);
    const f = DomainFailure.validation(input, err);
    expect(f.metadata).toHaveProperty('input');
    expect(f.metadata).toHaveProperty('issues');
  });

  it('issues is structured {field, message}[]', () => {
    const input = { email: 'bad' };
    const err = zodError(input);
    const f = DomainFailure.validation(input, err);
    const issues = f.metadata['issues'] as Array<{
      field: string;
      message: string;
    }>;
    expect(Array.isArray(issues)).toBe(true);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toHaveProperty('field');
    expect(issues[0]).toHaveProperty('message');
  });
});

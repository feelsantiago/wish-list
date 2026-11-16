import { describe, it, expect } from 'vitest';
import { FailureStatus } from './failure-status.js';

describe('FailureStatus', () => {
  it.each([
    ['invalid', 400, 'Invalid request'],
    ['forbidden', 403, 'Forbidden'],
    ['plan-required', 403, 'This feature requires a different plan'],
    ['not-found', 404, 'Not found'],
    ['conflict', 409, 'Conflict'],
    ['unexpected', 500, 'Something went wrong'],
  ])('maps %s to %i', (name, status, message) => {
    expect(FailureStatus.of(name)).toBe(status);
    expect(FailureStatus.message(name)).toBe(message);
  });

  it('falls through to 500 for a service-specific tag', () => {
    expect(FailureStatus.of('llm-failed')).toBe(500);
    expect(FailureStatus.message('llm-failed')).toBe('Something went wrong');
  });

  it('does not treat inherited object keys as tags', () => {
    expect(FailureStatus.of('toString')).toBe(500);
  });
});

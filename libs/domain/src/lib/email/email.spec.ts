import { Failure } from '@wish-list/common-error';
import { Email } from './email.js';

describe('Email.create', () => {
  it('accepts valid email', () => {
    const result = Email.create('user@example.com');
    expect(result.isOk()).toBe(true);
  });

  it('normalizes to lowercase', () => {
    const result = Email.create('USER@EXAMPLE.COM');
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value).toBe('user@example.com');
  });

  it('rejects invalid email', () => {
    const result = Email.create('not-an-email');
    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe('validation');
    expect(result.error.source).toBeInstanceOf(Failure);
    const source = result.error.source as Failure;
    expect(source.metadata['issues']).toBeDefined();
  });
});

describe('Email.from', () => {
  it('trusts the value without validation', () => {
    const email = Email.from('user@example.com');
    expect(email).toBe('user@example.com');
  });
});

import { Failure } from '@wish-list/common-error';
import { Url } from './url.js';

describe('Url.create', () => {
  it('accepts valid http url', () => {
    const result = Url.create('http://example.com');
    expect(result.isOk()).toBe(true);
  });

  it('accepts valid https url', () => {
    const result = Url.create('https://example.com/path?query=1');
    expect(result.isOk()).toBe(true);
  });

  it('rejects javascript: scheme', () => {
    const result = Url.create('javascript:alert(1)');
    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe('validation');
    expect(result.error.source).toBeInstanceOf(Failure);
  });

  it('rejects data: scheme', () => {
    const result = Url.create('data:text/plain,hello');
    expect(result.isErr()).toBe(true);
  });

  it('rejects malformed strings', () => {
    const result = Url.create('not-a-url');
    expect(result.isErr()).toBe(true);
  });
});

describe('Url.from', () => {
  it('trusts the value without validation', () => {
    const url = Url.from('any-string');
    expect(url).toBe('any-string');
  });
});

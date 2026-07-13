import { Failure } from '@wish-list/common-error';
import { VendorDomain } from './vendor-domain.js';

describe('VendorDomain.create', () => {
  it('accepts valid hostname', () => {
    const result = VendorDomain.create('example.com');
    expect(result.isOk()).toBe(true);
  });

  it('lowercases the hostname', () => {
    const result = VendorDomain.create('EXAMPLE.COM');
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value).toBe('example.com');
  });

  it('rejects input containing a protocol', () => {
    const result = VendorDomain.create('https://example.com');
    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe('validation');
    expect(result.error.source).toBeInstanceOf(Failure);
  });

  it('rejects input containing a path', () => {
    const result = VendorDomain.create('example.com/path');
    expect(result.isErr()).toBe(true);
  });

  it('rejects input containing spaces', () => {
    const result = VendorDomain.create('exa mple.com');
    expect(result.isErr()).toBe(true);
  });

  it('rejects empty string', () => {
    const result = VendorDomain.create('');
    expect(result.isErr()).toBe(true);
  });
});

describe('VendorDomain.from', () => {
  it('trusts the value without validation', () => {
    const domain = VendorDomain.from('any-string');
    expect(domain).toBe('any-string');
  });
});

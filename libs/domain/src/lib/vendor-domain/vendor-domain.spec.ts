import { Failure } from '@wish-list/common-error';
import { Url } from '../url/url.js';
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

describe('VendorDomain.fromUrl', () => {
  it('reduces a subdomain to the registrable domain', () => {
    const result = VendorDomain.fromUrl(Url.from('https://www.amazon.com/dp/123'));
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value).toBe('amazon.com');
  });

  it('reduces amazon.com and www.amazon.com to the same domain', () => {
    const bare = VendorDomain.fromUrl(Url.from('https://amazon.com'));
    const www = VendorDomain.fromUrl(Url.from('https://www.amazon.com'));
    expect(bare.isOk() && www.isOk() && bare.value === www.value).toBe(true);
  });

  it('resolves a multi-part public suffix to its eTLD+1', () => {
    const result = VendorDomain.fromUrl(Url.from('https://www.amazon.com.br'));
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value).toBe('amazon.com.br');
  });

  it('rejects a URL with no resolvable registrable domain', () => {
    const result = VendorDomain.fromUrl(Url.from('https://localhost'));
    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe('validation');
    expect(result.error.source).toBeInstanceOf(Failure);
  });
});

import { Failure } from '@wish-list/common-error';
import { VendorDomain } from '../vendor-domain/vendor-domain.js';
import { Url } from '../url/url.js';
import { Vendor } from './vendor.js';

function provisionalVendor(): Vendor {
  return Vendor.provisional({
    vendorDomain: VendorDomain.from('amazon.com'),
    website: Url.from('https://amazon.com'),
  });
}

describe('Vendor.provisional', () => {
  it('builds a ProvisionalVendor with a generated id and equal timestamps', () => {
    const vendor = provisionalVendor();
    expect(vendor._tag).toBe('provisional');
    expect(vendor.id).toBeTruthy();
    expect(vendor.vendorDomain).toBe('amazon.com');
    expect(vendor.website).toBe('https://amazon.com');
    expect(vendor.createdAt).toEqual(vendor.updatedAt);
  });
});

describe('Vendor.resolve', () => {
  it('transitions a ProvisionalVendor to a ResolvedVendor', () => {
    const provisional = provisionalVendor();
    const result = Vendor.resolve(provisional, {
      name: 'Amazon',
      website: Url.from('https://www.amazon.com'),
      currency: 'USD',
    });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    const resolved = result.value;
    expect(resolved._tag).toBe('resolved');
    expect(resolved.name).toBe('Amazon');
    expect(resolved.website).toBe('https://www.amazon.com');
    expect(resolved.currency).toBe('USD');
    expect(resolved.updatedAt.getTime()).toBeGreaterThanOrEqual(
      provisional.updatedAt.getTime(),
    );
  });

  it('re-resolves an already-resolved Vendor', () => {
    const provisional = provisionalVendor();
    const first = Vendor.resolve(provisional, {
      name: 'Amazon',
      website: Url.from('https://www.amazon.com'),
      currency: 'USD',
    });
    if (first.isErr()) throw new Error('unreachable');

    const second = Vendor.resolve(first.value, {
      name: 'Amazon Updated',
      website: Url.from('https://www.amazon.com'),
      currency: 'USD',
    });
    expect(second.isOk()).toBe(true);
    if (second.isErr()) return;
    expect(second.value.name).toBe('Amazon Updated');
  });

  it('rejects an empty name', () => {
    const result = Vendor.resolve(provisionalVendor(), {
      name: '',
      website: Url.from('https://amazon.com'),
      currency: 'USD',
    });
    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe('validation');
    expect(result.error.source).toBeInstanceOf(Failure);
  });
});

describe('Vendor.isProvisional / Vendor.isResolved', () => {
  it('narrows a ProvisionalVendor', () => {
    const vendor = provisionalVendor();
    expect(Vendor.isProvisional(vendor)).toBe(true);
    expect(Vendor.isResolved(vendor)).toBe(false);
  });

  it('narrows a ResolvedVendor', () => {
    const result = Vendor.resolve(provisionalVendor(), {
      name: 'Amazon',
      website: Url.from('https://amazon.com'),
      currency: 'USD',
    });
    if (result.isErr()) throw new Error('unreachable');
    expect(Vendor.isResolved(result.value)).toBe(true);
    expect(Vendor.isProvisional(result.value)).toBe(false);
  });
});

describe('Vendor round-trip', () => {
  it('deep-equals the original ProvisionalVendor', () => {
    const vendor = provisionalVendor();
    expect(Vendor.from(Vendor.plain(vendor))).toEqual(vendor);
  });

  it('deep-equals the original ResolvedVendor', () => {
    const result = Vendor.resolve(provisionalVendor(), {
      name: 'Amazon Brasil',
      website: Url.from('https://amazon.com.br'),
      currency: 'BRL',
    });
    if (result.isErr()) throw new Error('unreachable');
    expect(Vendor.from(Vendor.plain(result.value))).toEqual(result.value);
  });
});

import { Failure } from '@wish-list/common-error';
import { Vendor } from './vendor.js';

describe('Vendor.create', () => {
  const validInput = {
    vendorDomain: 'amazon.com',
    website: 'https://amazon.com',
    name: 'Amazon',
    currency: 'USD' as const,
  };

  it('builds a Vendor with a generated id and equal timestamps', () => {
    const result = Vendor.create(validInput);
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    const vendor = result.value;
    expect(vendor.id).toBeTruthy();
    expect(vendor.vendorDomain).toBe('amazon.com');
    expect(vendor.website).toBe('https://amazon.com');
    expect(vendor.name).toBe('Amazon');
    expect(vendor.currency).toBe('USD');
    expect(vendor.createdAt).toEqual(vendor.updatedAt);
  });

  it('rejects an invalid vendorDomain', () => {
    const result = Vendor.create({
      ...validInput,
      vendorDomain: 'https://amazon.com',
    });
    expect(result.isErr()).toBe(true);
    if (result.isOk()) return;
    expect(result.error.name).toBe('validation');
    expect(result.error.source).toBeInstanceOf(Failure);
  });

  it('rejects an invalid website', () => {
    const result = Vendor.create({ ...validInput, website: 'not-a-url' });
    expect(result.isErr()).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = Vendor.create({ ...validInput, name: '' });
    expect(result.isErr()).toBe(true);
  });

  it('rejects an invalid currency', () => {
    // @ts-expect-error -- testing invalid runtime input
    const result = Vendor.create({ ...validInput, currency: 'EUR' });
    expect(result.isErr()).toBe(true);
  });
});

describe('Vendor round-trip', () => {
  it('deep-equals the original Vendor', () => {
    const result = Vendor.create({
      vendorDomain: 'amazon.com.br',
      website: 'https://amazon.com.br',
      name: 'Amazon Brasil',
      currency: 'BRL',
    });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    const vendor = result.value;
    expect(Vendor.from(Vendor.plain(vendor))).toEqual(vendor);
  });
});

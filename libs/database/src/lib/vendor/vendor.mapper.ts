import type { Provider } from '@nestjs/common';
import { Vendor } from '@wish-list/domain';
import type { Plain } from '@wish-list/domain';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';

export const VENDOR_MAPPER = Symbol('VENDOR_MAPPER');

export function createVendorMapper(): DatabaseDomainMapper<Vendor, Plain<Vendor>> {
  return DatabaseDomainMapper.create(Vendor.plain, Vendor.from);
}

export const vendorMapperProvider: Provider = {
  provide: VENDOR_MAPPER,
  useFactory: createVendorMapper,
};

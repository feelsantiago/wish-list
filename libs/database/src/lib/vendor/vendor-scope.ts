import { eq } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { VendorDomain } from '@wish-list/domain';
import { QueryScope } from '../repository/query-scope.js';
import { vendors } from './vendor.schema.js';

export class VendorScope extends QueryScope<typeof vendors> {
  private constructor(private readonly domain: VendorDomain) {
    super();
  }

  public condition(table: typeof vendors): SQL | undefined {
    return eq(table.vendorDomain, this.domain);
  }

  public static domain(domain: VendorDomain): VendorScope {
    return new VendorScope(domain);
  }
}

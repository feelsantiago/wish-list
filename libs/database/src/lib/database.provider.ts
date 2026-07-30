import type { Provider } from '@nestjs/common';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { createDatabaseClient } from './client/client.js';
import { UserRepository } from './user/user.repository.js';
import { WishlistRepository } from './wishlist/wishlist.repository.js';
import { CategoryRepository } from './category/category.repository.js';
import { VendorRepository } from './vendor/vendor.repository.js';
import { ItemRepository } from './item/item.repository.js';
import { CouponRepository } from './coupon/coupon.repository.js';
import { CouponRuleRepository } from './coupon-rule/coupon-rule.repository.js';
import { ReservationRepository } from './reservation/reservation.repository.js';
import { TrackedItemRepository } from './tracked-item/tracked-item.repository.js';
import { PriceHistoryRepository } from './price-history/price-history.repository.js';
import { DATABASE_CLIENT, MODULE_OPTIONS_TOKEN } from './database.module.js';
import type { DatabaseModuleOptions } from './database.module.js';

export const clientProvider: Provider = {
  provide: DATABASE_CLIENT,
  useFactory: (options: DatabaseModuleOptions): LibSQLDatabase =>
    createDatabaseClient(options.url),
  inject: [MODULE_OPTIONS_TOKEN],
};

function repositoryProvider<TRepository>(
  repository: new (db: LibSQLDatabase) => TRepository,
): Provider {
  return {
    provide: repository,
    useFactory: (db: LibSQLDatabase) => new repository(db),
    inject: [DATABASE_CLIENT],
  };
}

export const repositoryProviders = [
  repositoryProvider(UserRepository),
  repositoryProvider(WishlistRepository),
  repositoryProvider(CategoryRepository),
  repositoryProvider(VendorRepository),
  repositoryProvider(ItemRepository),
  repositoryProvider(CouponRepository),
  repositoryProvider(CouponRuleRepository),
  repositoryProvider(ReservationRepository),
  repositoryProvider(TrackedItemRepository),
  repositoryProvider(PriceHistoryRepository),
];

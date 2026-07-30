import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { DATABASE_CLIENT } from '../database-client.token.js';
import { userMapperProvider } from '../user/user.mapper.js';
import { wishlistMapperProvider } from '../wishlist/wishlist.mapper.js';
import { categoryMapperProvider } from '../category/category.mapper.js';
import { vendorMapperProvider } from '../vendor/vendor.mapper.js';
import { reservationMapperProvider } from '../reservation/reservation.mapper.js';
import { trackedItemMapperProvider } from '../tracked-item/tracked-item.mapper.js';
import { CouponDatabaseDomainMapper } from '../coupon/coupon.mapper.js';
import { CouponRuleDatabaseDomainMapper } from '../coupon-rule/coupon-rule.mapper.js';
import { ItemDatabaseDomainMapper } from '../item/item.mapper.js';
import { PriceHistoryDatabaseDomainMapper } from '../price-history/price-history.mapper.js';
import { UserRepository } from '../user/user.repository.js';
import { WishlistRepository } from '../wishlist/wishlist.repository.js';
import { CategoryRepository } from '../category/category.repository.js';
import { VendorRepository } from '../vendor/vendor.repository.js';
import { ItemRepository } from '../item/item.repository.js';
import { CouponRepository } from '../coupon/coupon.repository.js';
import { CouponRuleRepository } from '../coupon-rule/coupon-rule.repository.js';
import { ReservationRepository } from '../reservation/reservation.repository.js';
import { TrackedItemRepository } from '../tracked-item/tracked-item.repository.js';
import { PriceHistoryRepository } from '../price-history/price-history.repository.js';

export function createTestingModule(db: LibSQLDatabase): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      { provide: DATABASE_CLIENT, useValue: db },
      userMapperProvider,
      wishlistMapperProvider,
      categoryMapperProvider,
      vendorMapperProvider,
      reservationMapperProvider,
      trackedItemMapperProvider,
      CouponDatabaseDomainMapper,
      CouponRuleDatabaseDomainMapper,
      ItemDatabaseDomainMapper,
      PriceHistoryDatabaseDomainMapper,
      UserRepository,
      WishlistRepository,
      CategoryRepository,
      VendorRepository,
      ItemRepository,
      CouponRepository,
      CouponRuleRepository,
      ReservationRepository,
      TrackedItemRepository,
      PriceHistoryRepository,
    ],
  }).compile();
}

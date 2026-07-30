import { ConfigurableModuleBuilder, Module } from '@nestjs/common';
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
import { Repositories } from './repository/repositories.js';
import { clientProvider } from './database.provider.js';
import { userMapperProvider } from './user/user.mapper.js';
import { wishlistMapperProvider } from './wishlist/wishlist.mapper.js';
import { categoryMapperProvider } from './category/category.mapper.js';
import { vendorMapperProvider } from './vendor/vendor.mapper.js';
import { reservationMapperProvider } from './reservation/reservation.mapper.js';
import { trackedItemMapperProvider } from './tracked-item/tracked-item.mapper.js';
import { CouponDatabaseDomainMapper } from './coupon/coupon.mapper.js';
import { CouponRuleDatabaseDomainMapper } from './coupon-rule/coupon-rule.mapper.js';
import { ItemDatabaseDomainMapper } from './item/item.mapper.js';
import { PriceHistoryDatabaseDomainMapper } from './price-history/price-history.mapper.js';
import { DATABASE_CLIENT } from './database-client.token.js';

export { DATABASE_CLIENT };

export interface DatabaseModuleOptions {
  url: string;
}

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<DatabaseModuleOptions>().build();

@Module({
  providers: [
    clientProvider,
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
    Repositories,
  ],
  exports: [
    DATABASE_CLIENT,
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
    Repositories,
  ],
})
export class DatabaseModule extends ConfigurableModuleClass {}

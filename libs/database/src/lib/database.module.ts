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
import { clientProvider, repositoryProviders } from './database.provider.js';

export const DATABASE_CLIENT = Symbol('DATABASE_CLIENT');

export interface DatabaseModuleOptions {
  url: string;
}

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<DatabaseModuleOptions>().build();

@Module({
  providers: [clientProvider, ...repositoryProviders],
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
  ],
})
export class DatabaseModule extends ConfigurableModuleClass {}

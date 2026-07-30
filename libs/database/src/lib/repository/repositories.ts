import { Injectable } from '@nestjs/common';
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

@Injectable()
export class Repositories {
  public constructor(
    public readonly users: UserRepository,
    public readonly wishlists: WishlistRepository,
    public readonly categories: CategoryRepository,
    public readonly vendors: VendorRepository,
    public readonly items: ItemRepository,
    public readonly coupons: CouponRepository,
    public readonly couponRules: CouponRuleRepository,
    public readonly reservations: ReservationRepository,
    public readonly trackedItems: TrackedItemRepository,
    public readonly priceHistory: PriceHistoryRepository,
  ) {}
}

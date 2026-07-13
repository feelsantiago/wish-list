# Field names omit type-redundant suffixes

Domain entity fields are named for the concept they reference, not decorated with a suffix restating their type: `user: Id`, `vendor: Id`, `website: Url` — not `userId: Id`, `vendorId: Id`, `websiteUrl: Url`. The branded type (ADR-0006) already tells a reader what kind of value the field holds; repeating that in the field name is redundant, and can drift out of sync if a field's type ever changes without a rename to match.

## Considered options

- **`xId`-suffix convention** (common in most codebases, mirrors SQL foreign-key column naming like `user_id`): familiar and greppable, but in `libs/domain` the branded type already carries "this is an Id, specifically a User's" — the suffix mostly repeats what `user: Id` already says via its position in the interface. Rejected for domain entity interfaces.
- **Type-name-free field names (chosen)**: fields read as `category.user`, `vendor.website`, `item.vendor` — the field name says what it references, the declared type says what kind of value it is.

## Consequences

- Applies to `libs/domain` entity interfaces specifically. `libs/database`'s Drizzle schema (actual SQL column names) is a separate naming surface and may keep conventional column names (e.g. `user_id`) since SQL has no branded types to lean on — the mapping between the two happens in each entity's `from()`/`plain()`.
- Every future entity with a cross-reference follows this convention: `Wishlist.user`, `Item.vendor`, `Item.category`, `Coupon.vendor`, `CouponRule.coupon`, `TrackedItem.item`.
- `User` (PRD-0003) has no FK-style fields, so it's unaffected. `Vendor`/`Category` (PRD-0004) are the first entities to apply this.

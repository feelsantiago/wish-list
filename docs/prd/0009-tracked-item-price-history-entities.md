## Problem Statement

`CONTEXT.md` describes Tracked Item (a Pro-only opt-in to daily automatic price fetching for an Item) and Price History (the chronological record of an Item's fetched prices) — neither exists in `libs/domain` yet. PRD-0008 named `tracking` as the feature area following Sharing/Reservation. This PRD adds both entities.

## Solution

Add `TrackedItem` (`libs/domain/src/lib/tracked-item/tracked-item.ts`, ADR-0007 interface + namespace pattern): a single row per `Item`, for the `Item`'s whole life, toggled on/off rather than recreated. `active: boolean` records whether daily fetching is currently happening; `stop`/`resume` flip it (mirroring `Wishlist.publish`/`unpublish` exactly — a boolean flip can't fail, so both return `TrackedItem` directly, no `Result`). `create` likewise takes only an already-trusted `item: Id` with nothing to validate, so it also returns `TrackedItem` directly.

Add `PriceHistory` (`libs/domain/src/lib/price-history/price-history.ts`): an immutable, create-only record of one fetched price at one point in time, FK'd to `Item` via `item: Id`. `price: Money` arrives pre-constructed, so `create` is also a plain-returning function — this PRD introduces the domain's first two entities with zero `Result`/`DomainFailure` surface, a direct consequence of both `create` functions taking only already-trusted/already-validated inputs.

## User Stories

### TrackedItem

1. As a developer, I want a `TrackedItem` interface: `id: Id`, `item: Id`, `active: boolean`, `createdAt: Date`, `updatedAt: Date`.
2. As a developer, I want `TrackedItem.create(item: Id): TrackedItem` — generates `id`, stamps `createdAt`/`updatedAt`, defaults `active: true`. No `Result`, no `zod` schema — nothing to validate.
3. As a developer, I want `TrackedItem.stop(trackedItem: TrackedItem): TrackedItem` and `TrackedItem.resume(trackedItem: TrackedItem): TrackedItem` — flip `active` and refresh `updatedAt`, same shape as `Wishlist.publish`/`unpublish`.
4. As a developer, I want `TrackedItem.from(plain)`/`TrackedItem.plain(trackedItem)` per ADR-0007/0009.

### PriceHistory

5. As a developer, I want a `PriceHistory` interface: `id: Id`, `item: Id`, `price: Money`, `fetchedAt: Date` — no `updatedAt` (immutable once recorded; create-only, same as `Reservation`).
6. As a developer, I want `PriceHistory.create(input: { item: Id; price: Money }): PriceHistory` — treats both `item` and `price` as already-trusted/already-validated, generates `id`, stamps `fetchedAt`. No `Result`, no `zod` schema.
7. As a developer, I want `PriceHistory.from(plain)`/`PriceHistory.plain(priceHistory)` per ADR-0007/0009.

## Implementation Decisions

- **File locations:** `libs/domain/src/lib/tracked-item/tracked-item.ts` and `libs/domain/src/lib/price-history/price-history.ts`, following the `coupon`/`coupon-rule` two-folder pattern for paired-but-separate entities.
- **One `TrackedItem` per `Item`, for its lifetime:** re-tracking after `stop` calls `resume` on the same row, it does not `create` a new one. A `libs/database` unique constraint on `TrackedItem.item` enforces this — same precedent as `Reservation.item`, `Category.name`, `Coupon.code`.
- **`PriceHistory.item` FK, not `PriceHistory.trackedItem`:** Price History rows point directly at the `Item`, not at the `TrackedItem`.
- **No dedup on unchanged price:** `PriceHistory.create` is called on every fetch regardless of whether the price changed since the last row. Skipping unchanged fetches (if ever wanted) is a service-layer/db-layer optimization, not a domain concern.
- **Pro-only gating** isn't threaded into `TrackedItem.create`'s signature — service layer checks `plan === 'pro'` (ADR-0012) before calling it, same treatment as `CouponRule` (PRD-0007) and `Reservation` (PRD-0008).
- **Trend ("trending lower/higher")** is not a domain function. Same treatment as Effective Price (PRD-0007's Coupon Rule): a read-time computation over stored rows, deferred to a later layer.

## Testing Decisions

- `TrackedItem.create`: generates `id`, stamps `createdAt`/`updatedAt`, defaults `active: true`.
- `TrackedItem.stop`/`resume`: flips `active`, refreshes `updatedAt`, leaves `id`/`item`/`createdAt` unchanged.
- `TrackedItem.from(TrackedItem.plain(trackedItem))` round-trips.
- `PriceHistory.create`: generates `id`, stamps `fetchedAt`, carries `trackedItem`/`price` through unchanged.
- `PriceHistory.from(PriceHistory.plain(priceHistory))` round-trips.
- Test runner: Vitest.

## Out of Scope

- Trend computation (comparing a Price History row against prior rows to say "lower"/"higher") — deferred, same as Effective Price.
- The daily fetch job itself (scheduling, actually hitting the Vendor's page) — infra/service-layer concern, not `libs/domain`.
- Dedup of unchanged-price fetches — deferred to service/db layer if ever wanted.
- One-`TrackedItem`-per-`Item` enforcement at the domain layer — pushed to `libs/database` (see Implementation Decisions).
- Pro-plan gating logic itself — service-layer concern, not `libs/domain` (same as `CouponRule`, `Reservation`).
- Price History retention/pruning policy — not specced here.
- Any UI/routing concern for displaying price trend charts.

## Further Notes

- Depends on `libs/domain` foundation: `Id`, `Money`, `Plain<T>`, the namespace pattern (ADR-0007), and `Wishlist.publish`/`unpublish`'s precedent for boolean-flip mutators returning a plain type instead of `Result`.
- First entity pair in this domain with zero `Result`/`DomainFailure` surface across all their functions — a deliberate consequence of both `create` functions taking only already-trusted/already-validated inputs, not an oversight.
- Closes out the `tracking` feature area named in ADR-0004/PRD-0008. Reservation cancellation (PRD-0008's remaining open item) is still unaddressed, tracked separately.

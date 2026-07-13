## Problem Statement

`CONTEXT.md` describes `Coupon` (Free-plan manual discount storage) and `Coupon Rule` (Pro-only auto-matching), but neither exists in `libs/domain` yet. Both need a concrete discount representation the glossary never specified — resolved during this PRD's grilling session: a `Coupon`'s discount is either a fixed `Money` amount or a percentage (see updated `CONTEXT.md` Coupon entry).

## Solution

Add `Coupon` and `CouponRule` to `libs/domain` (interface + namespace, ADR-0007). `Coupon` is a discriminated union on `_tag: 'fixed' | 'percentage'` (ADR-0008 — the two variants differ in shape: `amount: Money` vs `percentage: number`). `CouponRule` references its `Coupon` by `Id` and carries its own `threshold: Money`, per `CONTEXT.md`'s "vendor and validity conditions are inherited from this \[Coupon\], not restated on the Rule."

Matching and Effective Price are **not** a stored relation — the grilling session explicitly rejected attaching a `Coupon` to an `Item` as persisted state, to avoid ever having to detect/drop a stale reference when a `Coupon` expires. Instead, `Coupon`/`CouponRule` expose pure functions (`Coupon.applyTo`, `CouponRule.qualifies`) that the service layer calls fresh against a given `Item`'s price at read time, for both the Free-plan manual-preview path and the Pro-plan auto-matching path — same functions, different callers. `Item` itself is unchanged by this PRD.

`Money` (`libs/domain/src/lib/money/money.ts`) is loosened from `.positive()` to `.nonnegative()`, since a fixed discount larger than an Item's price produces a $0 Effective Price (floored, not rejected) — see Implementation Decisions.

Introduces ADR-0014 (cross-entity value passing for create-time invariants): `Coupon.create`'s fixed variant and `CouponRule.create` both need the referenced Vendor's `Currency` to validate against, not just its `Id` — first case in this codebase where a create-time rule depends on a *value* from a referenced entity, not just the entity's presence.

## User Stories

### Coupon

1. As a developer, I want `Coupon` as `FixedCoupon | PercentageCoupon`, both sharing `id: Id`, `user: Id`, `vendor: Id`, `code: string`, `expiresAt: Date`, `createdAt: Date`, `updatedAt: Date`; `FixedCoupon` adds `_tag: 'fixed'` and `amount: Money`; `PercentageCoupon` adds `_tag: 'percentage'` and `percentage: number` (integer, 1–99 inclusive).
2. As a developer, I want `Coupon.create(input)` to accept `user: Id` and `vendor: Id` as already-trusted (no re-validation, per PRD-0003/0004 precedent), plus `vendorCurrency: Currency` (the Vendor's actual currency, per ADR-0014), `code: string` (non-empty), `expiresAt: Date` (must be strictly after "now"), and a discriminated `discount` input (`{ type: 'fixed'; amount: number; currency: Currency }` or `{ type: 'percentage'; percentage: number }`).
3. As a developer, I want `Coupon.create` to reject a `fixed` discount whose `currency` doesn't equal `vendorCurrency` (ADR-0014 — comparing/discounting across currencies is meaningless per ADR-0002), returning `DomainFailure`. The `percentage` variant has no currency to check.
4. As a developer, I want `Coupon.create` to reject `expiresAt <= now` — an already-expired coupon is a user input mistake, not a valid created state.
5. As a developer, I want `Coupon.isExpired(coupon: Coupon, now: Date): boolean` — `coupon.expiresAt <= now`.
6. As a developer, I want `Coupon.applyTo(coupon: Coupon, price: Money): Result<Money, DomainFailure>`: rejects if `price.currency` doesn't match the coupon's currency (fixed: `coupon.amount.currency`; percentage: no inherent currency, so it applies to any `price` — the currency check is the caller's `CouponRule.qualifies`/Vendor-scoping responsibility, not this function's); otherwise computes the discounted amount (`fixed`: `price.amount - coupon.amount.amount`; `percentage`: `price.amount * (1 - coupon.percentage / 100)`), floors at `0`, rounds half-up to 2 decimal places, and returns `Money.create(result, price.currency)`.
7. As a developer, I want `Coupon.from(plain)`/`Coupon.plain(coupon)` per ADR-0007/0009, distributing over the `_tag` union like `Item`'s (PRD-0005).

### CouponRule

8. As a developer, I want a `CouponRule` interface: `id: Id`, `coupon: Id`, `threshold: Money`, `createdAt: Date`, `updatedAt: Date` (ADR-0013 naming — no `couponId`).
9. As a developer, I want `CouponRule.create(input: { coupon: Id; vendorCurrency: Currency; threshold: { amount: number; currency: Currency } })` to validate `threshold.currency === vendorCurrency` (ADR-0014, same reasoning as `Coupon.create`'s fixed variant) and `threshold.amount` as a positive number, returning `Result<CouponRule, DomainFailure>`.
10. As a developer, I want `CouponRule.qualifies(rule: CouponRule, coupon: Coupon, price: Money): boolean` — `true` iff `!Coupon.isExpired(coupon, now)` and `price.currency === rule.threshold.currency` and `price.amount >= rule.threshold.amount`.
11. As a developer, I want many `CouponRule`s allowed per `Coupon` (no uniqueness constraint) — `CONTEXT.md` doesn't restrict this to 1:1.
12. As a developer, I want `CouponRule.from(plain)`/`CouponRule.plain(rule)` per ADR-0007/0009.

## Implementation Decisions

- **File locations:** `libs/domain/src/lib/coupon/coupon.ts` and `libs/domain/src/lib/coupon-rule/coupon-rule.ts`, following the `Item`/`Vendor` folder pattern.
- **`Coupon.$` validation:** a `zod` discriminated union on `_tag`, mirroring `Item`'s union handling (PRD-0005) but validated eagerly in `create` rather than via a `match`-based state machine, since `fixed`/`percentage` aren't states an existing `Coupon` transitions between — they're fixed at creation.
- **Percentage bound:** `z.number().int().min(1).max(99)` — grilling session capped below 100 (100%-off would make the item free, out of scope for "discount").
- **Money loosened to `.nonnegative()`:** `libs/domain/src/lib/money/money.ts:13`, changed from `.positive()`. Ripple: `Item.price` (PRD-0005) can now theoretically be `$0`, previously impossible — accepted as a minor, harmless widening, not a behavior change worth its own PRD.
- **Rounding:** half-up to 2 decimal places for `Coupon.applyTo`'s percentage math (standard currency rounding), applied via `Math.round(value * 100) / 100`.
- **ADR-0014 applied:** `Coupon.create` (fixed variant) and `CouponRule.create` both take `vendorCurrency: Currency` explicitly rather than the whole `Vendor` — the service layer fetches the `Vendor` and passes just its `currency`.
- **`Coupon.create`/`CouponRule.create`** both compose a `zod` schema + `Result.fromThrowable`, matching the established `Vendor`/`Category` pattern (PRD-0004), wrapping `ZodError` via `DomainFailure.validation(...).context(...)`.
- **No `_tag` on `CouponRule`** — it has one shape, no variants.

## Testing Decisions

- `Coupon.create`: valid `fixed` input builds a `FixedCoupon` with generated `id` and equal `createdAt`/`updatedAt`; valid `percentage` input builds a `PercentageCoupon`; mismatched `fixed` currency vs `vendorCurrency` fails with `DomainFailure`; `percentage` outside 1–99 fails; empty `code` fails; `expiresAt` in the past or equal to "now" fails.
- `Coupon.isExpired`: `expiresAt` in the past returns `true`; in the future returns `false`; exactly equal to "now" returns `true` (matches the `<=` in `create`'s rejection).
- `Coupon.applyTo`: `fixed` discount less than price subtracts correctly; `fixed` discount greater than price floors to `Money` with `amount: 0`; `percentage` discount computes and rounds half-up correctly (e.g. 10% off $19.99 → $17.99); mismatched currency (fixed coupon vs differently-currencied price) returns `DomainFailure`.
- `Coupon.from(Coupon.plain(coupon))` round-trips for both variants.
- `CouponRule.create`: valid input builds a `CouponRule`; mismatched `threshold.currency` vs `vendorCurrency` fails; non-positive `threshold.amount` fails.
- `CouponRule.qualifies`: price above threshold in matching currency with unexpired coupon → `true`; price below threshold → `false`; expired coupon → `false` regardless of price; mismatched currency → `false`.
- `CouponRule.from(CouponRule.plain(rule))` round-trips.
- `Money.$`: existing spec updated — `amount: 0` now passes, negative still fails.
- Test runner: Vitest.

## Out of Scope

- Any persisted `Item`↔`Coupon`/`CouponRule` relation — explicitly rejected during grilling; matching is always computed fresh at read time.
- "Which Items qualify for a given `CouponRule`" (the scan across a Vendor's Items) — service-layer query concern, not `libs/domain`.
- `Coupon`/`CouponRule` edit functions (rename code, adjust threshold/expiry/amount) — create-only in this PRD, matching `Vendor`'s deferred-edit precedent (PRD-0004); `updatedAt` exists on both types for when that PRD arrives.
- `Coupon.code` uniqueness enforcement (per User+Vendor) — `libs/database` schema concern, same treatment as `Category.name` (PRD-0004).
- Free-plan manual-preview UI and Pro-plan auto-matching engine themselves — both are service-layer callers of `Coupon.applyTo`/`CouponRule.qualifies`, not this PRD's domain-layer scope.
- `Coupon.applyTo`'s currency check for the `percentage` variant deliberately doesn't enforce Vendor-scoping — that's `CouponRule.qualifies`'s or the manual-preview caller's job to only ever pass a same-Vendor `Item`'s price.

## Further Notes

- Depends on `libs/domain` foundation: `Id`, `Money`, `Currency`, `DomainFailure`, `Plain<T>`, the namespace pattern (ADR-0007), `Item`'s `_tag` union handling (PRD-0005) as the closest reference for `Coupon`'s two-variant shape, and `Vendor`'s `create`/`from`/`plain` shape (PRD-0004).
- Introduces ADR-0014, the first case of a create-time invariant needing a referenced entity's actual field value rather than just its trusted `Id`.
- Closes out the `coupon` feature area named in ADR-0004's initial feature-slice list; `sharing` and `tracking` remain as future domain PRDs.

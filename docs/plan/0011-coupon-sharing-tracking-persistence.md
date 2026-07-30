# Implementation Plan — 0011 Coupon/Sharing/Tracking Persistence

No companion PRD. PRD-0010 (`libs/database` core slice) explicitly deferred
`coupon`, `sharing` (Reservation), and `tracking` (TrackedItem/PriceHistory)
persistence to "separate future PRDs once those `libs/domain` entities
existed long enough to stabilize" — they have since shipped (PRD-0007,
PRD-0008, PRD-0009) with full round-trip test coverage in `libs/domain`. This
plan closes that gap by extending `libs/database` with the same base infra
(`Repository`, `DatabaseDomainMapper`, `DatabaseFailure`) already established
by plan-0010, applied to the 5 remaining entities. No new architectural
decisions are introduced — ADR-0016 (concrete repos, no port), ADR-0017 (item
single-table/discriminated-union mapping), and ADR-0018 (DatabaseFailure
translation boundary) already govern this design and apply directly.

## Resolved decisions

1. **`PriceHistory.item`, not `PriceHistory.trackedItem`.** PRD-0009's prose
   specs a `trackedItem: Id` FK, but `libs/domain/src/lib/price-history/price-history.ts`
   and its spec have always implemented `item: Id`. The domain code and its
   tests are the actual, load-bearing contract — PRD-0009 gets a wording
   correction (see Phase 0), not the reverse. `price_history.item` FKs to
   `items.id`, not to `tracked_items.id`.
2. **`Coupon.code` uniqueness is `(user, vendor, code)`.** PRD-0007 names this
   explicitly ("uniqueness enforcement (per User+Vendor)") as a `libs/database`
   schema concern — this plan is where it lands.
3. **One doc, not three.** All 5 entities land in a single plan, mirroring
   how plan-0010 covered 5 entities in one pass, rather than one doc per
   PRD-0007/0008/0009 grouping.

## Baseline facts (verified)

- `libs/database` today: `category`, `item`, `user`, `vendor`, `wishlist` —
  each with `*.schema.ts`, `*.repository.ts` (+ real-db `*.repository.spec.ts`),
  registered in `database.module.ts` and `src/index.ts`. Base infra:
  `Repository<TEntity,TRow>` (`find`/`insert`/`update`, `find` on the base
  class only — no `delete`/`list`), `DatabaseDomainMapper<TEntity,TRow>`
  (generic, `.create(toRowFn, fromRowFn)`), `DomainMapper` interface,
  `DatabaseFailure`/`DatabaseError` (4 kinds: `notFound`/`constraint`/`query`/
  `mapping`), `client/client.ts`, `transaction/transaction.ts`.
- Simple entities (`Plain<T>` already flat/scalar) wire the generic mapper
  directly: `DatabaseDomainMapper.create(Vendor.plain, Vendor.from)`. Only
  `Item` needs a bespoke mapper class (`ItemDatabaseDomainMapper`) because it
  is a `_tag` discriminated union with a `Money` field to flatten
  (`price_amount`/`price_currency`) — built via `ts-pattern` `match(...).with(...).exhaustive()`
  over both the entity→row and row→entity directions.
  `ItemDatabaseDomainMapper` is **not** exported from `src/index.ts` — only
  `items` (schema) and `ItemRepository` are. Bespoke mappers are
  repository-internal.
- Schema conventions (`vendor.schema.ts`, `category.schema.ts`): `text('id').primaryKey()`,
  ISO-string `text` timestamps (no `DEFAULT CURRENT_TIMESTAMP`), enums via
  `text(col, { enum: [...] })`, FK via `.references(() => table.id)` with no
  explicit `onDelete` (default SQLite restrict behavior), `index(...)` for
  plain FK lookups, `uniqueIndex(...)` for single/composite uniqueness.
- Migration folder `libs/database/drizzle/` currently has exactly one
  migration (`0000_oval_ben_urich.sql`); schema glob in `drizzle.config.ts`
  is `./src/lib/**/*.schema.ts` (auto-picks up new files, no config change
  needed).
- The 5 target entities (`libs/domain/src/lib/{coupon,coupon-rule,reservation,tracked-item,price-history}/`):
  - **Coupon** — `FixedCoupon | PercentageCoupon` on `_tag`, shared
    `id`/`user`/`vendor`/`code`/`expiresAt`/`createdAt`/`updatedAt`; `fixed`
    adds `amount: Money`, `percentage` adds `percentage: number` (1–99).
  - **CouponRule** — `{ id, coupon, threshold: Money, createdAt, updatedAt }`,
    no `_tag`, many rules allowed per coupon (no uniqueness).
  - **Reservation** — `{ id, item, name, token, createdAt }`, no `updatedAt`
    (immutable, create-only).
  - **TrackedItem** — `{ id, item, active, createdAt, updatedAt }`.
  - **PriceHistory** — `{ id, item, price: Money, fetchedAt }`, no
    `createdAt`/`updatedAt` (append-only log).

## Phase 0 — PRD-0009 wording correction

In `docs/prd/0009-tracked-item-price-history-entities.md`, replace the
`trackedItem: Id` / "FK'd to `TrackedItem` (not directly to `Item`)" passages
(Solution paragraph, User Story #5, Implementation Decisions bullet) with
`item: Id`, matching the entity's actual, already-shipped shape. Independent
of every other phase.

## Phase 1 — Schema (`*.schema.ts`)

One `sqliteTable` per entity, same conventions as `vendor.schema.ts`:

- **coupons**: `user → users.id`, `vendor → vendors.id`, `code`,
  `tag text{enum:['fixed','percentage']}`, nullable `amount_amount real` +
  `amount_currency text{enum:['USD','BRL']}` (fixed variant only), nullable
  `percentage integer` (percentage variant only), `expiresAt`, `createdAt`,
  `updatedAt`. Indexes: `user`, `vendor`. **Unique: `(user, vendor, code)`**.
- **coupon_rules**: `coupon → coupons.id`, `threshold_amount real`,
  `threshold_currency text{enum}`, `createdAt`, `updatedAt`. Index: `coupon`.
  No uniqueness constraint.
- **reservations**: `item → items.id`, `name`, `token`, `createdAt` only (no
  `updatedAt`). **Unique: `item`** (one reservation per item).
- **tracked_items**: `item → items.id`, `active integer{mode:'boolean'}`,
  `createdAt`, `updatedAt`. **Unique: `item`** (one tracked-item per item).
- **price_history**: `item → items.id`, `price_amount real`,
  `price_currency text{enum}`, `fetchedAt` only (no `createdAt`/`updatedAt`).
  Index: `item` (non-unique — many rows per item over time).

## Phase 2 — Mappers + repositories

- **`CouponRepository`** — bespoke `coupon-database-domain-mapper.ts`,
  `ts-pattern` `match` on `_tag` exactly like `ItemDatabaseDomainMapper`,
  flattening `amount: Money` for the `fixed` variant. `findByUser(user: Id)`.
- **`CouponRuleRepository`** — generic `DatabaseDomainMapper` wired with
  custom inline `toRow`/`fromRow` (not `CouponRule.plain`/`from` directly)
  that flatten `threshold: Money` to `threshold_amount`/`threshold_currency`
  around calls to `CouponRule.plain`/`from`. `findByCoupon(coupon: Id)`.
- **`ReservationRepository`** — `Plain<Reservation>` is already flat:
  `DatabaseDomainMapper.create(Reservation.plain, Reservation.from)` directly,
  same treatment as Vendor/Category. `findByItem(item: Id)`.
- **`TrackedItemRepository`** — same direct-mapper treatment (`Plain<TrackedItem>`
  is flat). `findByItem(item: Id)`.
- **`PriceHistoryRepository`** — generic mapper with custom inline
  `toRow`/`fromRow` flattening `price: Money`, same technique as
  `CouponRuleRepository`. `findByItem(item: Id)`.

All finders return the full unpaginated array (`AsyncResult<TEntity[], DatabaseFailure>`),
matching `WishlistRepository.findByUser` / `ItemRepository.findByWishlist`.

## Phase 3 — Module + barrel wiring

- `database.module.ts`: add 5 imports, 5 `repositoryProvider(...)` entries,
  5 export entries. The existing `// TODO: use options and configurable
  providers` comment is untouched — out of scope here.
- `src/index.ts`: export the 5 new schema tables + 5 new repository classes.
  `CouponDatabaseDomainMapper` stays unexported, matching
  `ItemDatabaseDomainMapper`'s current internal-only treatment.

## Phase 4 — Migrations

Add the schema files, then `db:generate` (`drizzle-kit generate`) to produce
`0001_*.sql` plus updated journal/snapshot — no manual editing. Never
`drizzle-kit push`, never auto-run on API boot.

## Phase 5 — Tests

- `testing/fixtures.ts`: add `makeCoupon` (fixed + percentage variant
  builders), `makeCouponRule`, `makeReservation`, `makeTrackedItem`,
  `makePriceHistory`, following the existing `makeVendor`-style
  partial-override fixture shape.
- One `*.repository.spec.ts` per entity, mirroring `vendor.repository.spec.ts`:
  insert→find round-trip, `find` on a missing id ⇒ `notFound`, duplicate
  unique field ⇒ `constraint`.
  - `Coupon`: round-trip both tags (fixed/percentage); constraint test on
    duplicate `(user, vendor, code)`.
  - `Reservation` / `TrackedItem`: constraint test on duplicate `item`.
  - `CouponRule` / `PriceHistory`: `findByCoupon`/`findByItem` returns
    multiple rows for the same parent (no uniqueness expected here).
  - `TrackedItem`: round-trip `stop`/`resume` through `update`.

## Sequencing / dependencies

- Phase 0 is independent (docs only, no code).
- P1 (schema) → P2 (mappers/repos) → P3 (module/barrel) → P4 (migrations).
- P5 (tests) depends on P1 + P2 (schema + repositories) but not on P3/P4
  wiring.

## Risks / watch-items

- **Money flattening now has 4 call sites** (`Item.price`, `Coupon.amount`
  fixed-variant, `CouponRule.threshold`, `PriceHistory.price`) — consistent
  repetition of an established pattern, not a new risk.
- **Boolean storage**: `tracked_items.active` must use
  `integer({mode:'boolean'})`, same watch-item plan-0010 flagged for
  `wishlists.published`, so the round-trip deep-equal doesn't fail.
- **Sparse timestamp columns**: `reservations` has no `updatedAt`;
  `price_history` has neither `createdAt` nor `updatedAt`. Don't copy the
  `createdAt`/`updatedAt` boilerplate from other schemas without checking
  each entity's actual shape first.
- **`docs/prd/0009` edit** is a deliberate spec correction (the code was
  already right) — call it out as such in the commit/PR description rather
  than folding it silently into the persistence-layer commit.

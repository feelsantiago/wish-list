## Problem Statement

`libs/domain` has 6 core-slice entities implemented (`User`, `Wishlist`, `Item`, `Vendor`, `Category`, plus the `Plan`/`Status` literal fields on `User`) with no persistence behind them. ADR-0003 already picked Drizzle + `@libsql/client` targeting Turso; ADR-0004 reserves `libs/database` as a cross-cutting lib (`Drizzle schema + Turso/libsql client, repository implementations`) but the lib doesn't exist yet. No feature `service` lib can be built until something implements reads/writes for these entities.

## Solution

Add `libs/database`, covering the User/Plan, Wishlist, Item, Vendor, Category feature areas only (`coupon`, `sharing`, `tracking` are out of scope — separate future PRDs once those `libs/domain` entities existed long enough to stabilize). Each entity gets a Drizzle table whose row shape mirrors that entity's own `Plain<T>` as closely as SQLite allows, reusing the existing `.from()`/`.plain()` round-trip functions already on each entity namespace instead of a second independent mapping layer. The two cases where SQLite has no equivalent type get a targeted flatten: `Money` fields (`Item.price`, and `PriceHistory.price` when that slice lands) become two columns (`_amount: real`, `_currency: text`) per field; `Item`'s 3-tag discriminated union (ADR-0008) becomes one `items` table with a `tag` column and nullable columns for whichever fields don't apply to every tag (ADR-0017).

Repositories are concrete classes (no port/interface in `libs/domain` — ADR-0016), sharing a generic base (`find`, insert, update, Drizzle-call wrapping, error translation) with entity-specific finders (`findByWishlist`, `findByUser`, …) on the concrete subclasses. Every repository method returns `AsyncResult<Entity, DatabaseFailure>` — `DatabaseFailure` (new type, `libs/database`) is the only error vocabulary that crosses the `libs/database` → `service` boundary; a `DomainFailure` raised while reconstructing a row (e.g. `Item.from(row)` failing validation) is re-tagged into `DatabaseFailure`'s `mapping` variant via `Failure.from(...)`, never passed through as-is (ADR-0018). A single `DatabaseModule` (Nest) owns the shared `@libsql/client` connection and provides every repository as a DI token; feature `service` modules just import `DatabaseModule` and inject what they need.

`User` additionally gets a `status: 'active' | 'deactivated'` + `deactivatedAt: Option<Date>` (ADR-0019) — already implemented in `libs/domain/src/lib/user/user.ts` (`ActiveUser`/`DeactivatedUser` types, `deactivate`/`reactivate` functions) ahead of this PRD, since it's a domain-layer prerequisite for the `users` table's schema.

## User Stories

### Schema

1. As a developer, I want `libs/database/src/lib/<entity>/<entity>.schema.ts` per entity (`user.schema.ts`, `wishlist.schema.ts`, `item.schema.ts`, `vendor.schema.ts`, `category.schema.ts`), each exporting one Drizzle `sqliteTable(...)` definition, mirroring `libs/domain`'s one-namespace-per-file layout.
2. As a developer, I want every table's primary key to be `id: text('id').primaryKey()` (storing the domain's UUID string as-is, per `Id.$`'s `z.string().uuid()`), so no separate integer surrogate key exists anywhere in the core slice.
3. As a developer, I want `createdAt`/`updatedAt` (and `deactivatedAt` where present) stored as `text` ISO-8601 strings, set only by the application (entity constructors already compute `new Date()` on every mutation), with no `DEFAULT CURRENT_TIMESTAMP` or update-trigger on any column.
4. As a developer, I want `items.tag` (`'pending' | 'extracted' | 'failed'`) plus nullable `name`, `price_amount`, `price_currency`, `image` (extracted-only), `reason` (failed-only) columns on a single `items` table — no `items_extracted`/`items_failed` side tables.
5. As a developer, I want unique indexes on `users.email`, `users.(provider, providerId)`, `wishlists.slug`, `vendors.vendorDomain`, and `categories.(user, name)`.
6. As a developer, I want plain (non-unique) indexes on `wishlists.user`, `items.wishlist`, `items.category`, `items.vendor`, and `categories.user`, so the app's core read paths (list a User's Wishlists, list a Wishlist's Items) don't force a full table scan.
7. As a developer, I want FK `onDelete` set to `cascade` for `wishlists.user → users.id` and `items.wishlist → wishlists.id`, and `restrict` for `items.category → categories.id` and `items.vendor → vendors.id` — Categories/Vendors are never deleted by a code path that should also take Items down with them.

### Repository base + concrete repositories

8. As a developer, I want an abstract base (e.g. `libs/database/src/lib/repository/repository.ts`) providing `find(id: Id): AsyncResult<TEntity, DatabaseFailure>`, `insert(entity: TEntity): AsyncResult<TEntity, DatabaseFailure>`, `update(entity: TEntity): AsyncResult<TEntity, DatabaseFailure>`, parameterized by the entity's own `from`/`plain` functions and its Drizzle table, so the same insert/find/error-translation logic isn't hand-written 5 times.
9. As a developer, I want `UserRepository`, `WishlistRepository`, `ItemRepository`, `VendorRepository`, `CategoryRepository` each extending the base and adding only their entity-specific finders: `WishlistRepository.findByUser(user: Id)`, `ItemRepository.findByWishlist(wishlist: Id)`, `CategoryRepository.findByUser(user: Id)`, `VendorRepository.findByVendorDomain(domain: VendorDomain)`.
10. As a developer, I want every repository method wrapping its Drizzle/libsql call in `Result.fromThrowable`, never a raw `try`/`catch`, consistent with CLAUDE.md's Result-based convention already enforced in `libs/domain`.
11. As a developer, I want list-returning finders (`findByWishlist`, `findByUser`) to return the full unpaginated array — no cursor/offset parameter on any core-slice repository method yet.

### DatabaseFailure

12. As a developer, I want `DatabaseFailure` (`libs/database/src/lib/database-failure/database-failure.ts`), a `Failure<'notFound' | 'constraint' | 'query' | 'mapping'>` following `DomainFailure`'s namespace-of-factory-functions pattern (ADR-0010).
13. As a developer, I want `find(id)` on a row that doesn't exist to return `DatabaseFailure` named `notFound` (not `Option<Entity>`, not a thrown error).
14. As a developer, I want a unique/FK constraint violation from libsql caught and translated to `DatabaseFailure` named `constraint`, carrying the underlying driver error as `source`.
15. As a developer, I want `Entity.from(row)` failing (a `DomainFailure`) inside a repository's read path re-tagged to `DatabaseFailure` named `mapping` via `Failure.from(domainFailure, {...})`, preserving the original as `source` so `.toString()` still renders the causal chain.

### DatabaseModule + connection

16. As a developer, I want `libs/database` to export a Nest `DatabaseModule` constructing one shared `@libsql/client` instance from a connection URL read from config/env, and providing every repository class as an injectable.
17. As a developer, I want the same `DatabaseModule` code path used in every environment — local dev pointed at a local file (`file:./local.db` or similar, no live Turso account required), staging/prod pointed at a remote `libsql://` Turso URL — differing only by env var, not by a code branch.

### Transactions

18. As a developer, I want a `Database.transaction(fn)` helper (wrapping the libsql driver's transaction API) exported from `libs/database`, so a multi-repository-call operation — the first concrete case being `account/service`'s future signup flow (`UserRepository.insert` + `CategoryRepository.insert` for the default Unsorted Category) — can be wrapped so both writes succeed or fail together.

### Migrations

19. As a developer, I want `drizzle.config.ts` and the generated `drizzle/` migrations folder living inside `libs/database`, migrations generated via `drizzle-kit generate` (schema-diff) and committed to the repo — never `drizzle-kit push`.
20. As a developer, I want migrations applied via an explicit script/CI step, never auto-run when `apps/api` boots.

## Implementation Decisions

- **Row↔domain mapping** reuses each entity's existing `Entity.from(row)` / `Entity.plain(entity)` — repositories do not maintain a second, independent mapping.
- **Money flatten**: `price: Money` → `price_amount: real('price_amount')`, `price_currency: text('price_currency')`, assembled back into `{ amount, currency }` before calling `Item.from(...)`.
- **Item table**: single `sqliteTable('items', ...)` with `tag: text('tag', { enum: ['pending', 'extracted', 'failed'] })`; tag-specific column non-nullability (e.g. `extracted` rows must have `name`) is enforced by `Item.from(row)`'s own reconstruction logic, not a SQL `CHECK` constraint (per ADR-0017).
- **No repository interfaces** in `libs/domain` — `service` imports concrete classes directly from `libs/database` (ADR-0016). Nest DI's `overrideProvider` covers substituting a fake in tests; a hand-written port is deferred until a real second implementation is needed.
- **`DatabaseFailure` location**: `libs/database/src/lib/database-failure/database-failure.ts`, mirroring `libs/domain/src/lib/domain-failure/domain-failure.ts`'s shape (a thin namespace of `Failure`-constructing functions).
- **Base repository location**: `libs/database/src/lib/repository/repository.ts`.
- **`DatabaseModule` location**: `libs/database/src/lib/database.module.ts`, connection URL sourced from Nest `ConfigModule`/env (e.g. `DATABASE_URL`), same module code for local file and remote Turso.
- **Transaction helper location**: `libs/database/src/lib/transaction/transaction.ts`, exposing `Database.transaction<T>(fn: (tx) => Promise<T>): AsyncResult<T, DatabaseFailure>`.
- **Migrations**: `libs/database/drizzle.config.ts`, output to `libs/database/drizzle/`, generated via `drizzle-kit generate`, applied via an explicit `drizzle-kit migrate` invocation (script or CI step) — never on API boot.

## Testing Decisions

- Repository tests run against a real local libsql file (migrations applied beforehand), not a mocked `@libsql/client` — a mocked client can't catch a wrong `WHERE` clause or a missing unique constraint. Client-mocking (per ADR-0003) is reserved for `service`-layer tests that want to fake a repository entirely.
- Each repository: round-trip test (`insert` then `find` deep-equals the original entity), `find` on a missing id returns `DatabaseFailure` named `notFound`, a unique-constraint violation (e.g. duplicate `email`) returns `DatabaseFailure` named `constraint`.
- `Database.transaction`: a test forcing the second of two writes to fail, asserting the first write is rolled back (not left committed).
- `DatabaseModule`: a smoke test that the module can be instantiated against a local file DB and resolve every repository token.

## Out of Scope

- `coupon`, `sharing`, `tracking` feature slices' tables/repositories — separate future PRDs, once those `libs/domain` entities exist.
- Repository ports/interfaces in `libs/domain` (ADR-0016) — revisit only if a second persistence implementation or a non-Nest-DI fake becomes necessary.
- Pagination on any list-returning finder — add only if a specific list is shown to grow large.
- libsql embedded-replica mode — solves a read-latency problem this app doesn't have evidence of yet.
- Anonymization-on-deactivation for `User` (ADR-0019 explicitly separates this from the plain status-flag deactivation implemented here).
- Auto-migrate-on-boot — deliberately rejected; migrations are an explicit, reviewable step.
- `account/service`'s actual signup flow (the first caller of `Database.transaction` and the User+Category invariant) — this PRD only adds the transaction primitive it needs, not the service method itself.

## Further Notes

- Depends on: ADR-0003 (Drizzle/libsql tooling choice), ADR-0004 (`libs/database` boundary + dependency direction), ADR-0009 (`Plain<T>`), ADR-0010 (`Failure` pattern), and the 6 already-implemented `libs/domain` entities this PRD adds persistence for.
- Introduces ADR-0016 (concrete repositories, no port), ADR-0017 (Item single-table mapping), ADR-0018 (database-layer Failure translation boundary), and ADR-0019 (User deactivation instead of deletion) — all four written alongside this PRD.
- `CONTEXT.md` already updated with User's `Status` (Active/Deactivated) vocabulary; `user.ts` already updated with the corresponding fields/types ahead of this PRD landing.

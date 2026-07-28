# Implementation Plan — 0010 Database Layer (Core Slice)

Companion to `docs/prd/0010-database-layer-core-slice.md`. Adds `libs/database`
(`@wish-list/database`) covering User/Wishlist/Item/Vendor/Category persistence.

## Resolved decisions

1. **NestJS introduced now.** `libs/database` depends on `@nestjs/common` and ships
   the real `DatabaseModule` + repository DI tokens (PRD US 16). No `apps/*` consumes
   it yet; it is smoke-tested standalone (Testing Decisions).
2. **`Failure.from` gains an optional target-name arg — no new method.**
   `common-error`'s `Failure.from(failure, metadata)` currently inherits the source's
   runtime `.name` (spec: "inherits name from source"), so it cannot produce
   `name:'mapping'` while keeping `source:domainFailure`. Fix: extend `from` with an
   optional name so `Failure.from(domainFailure, {...}, 'mapping')` overrides the name
   and keeps the causal chain. This is the mechanism ADR-0018 relies on.

## Baseline facts (verified)

- Workspace is Nx TS-solution + **npm** workspaces. Each lib: `package.json`
  (name `@wish-list/<x>`, `type: module`, `exports` → `src/index.ts`, resolved via
  `customConditions: ["@wish-list/source"]`), `tsconfig.json` (refs lib+spec),
  `tsconfig.lib.json` (project-refs its dependency libs), `tsconfig.spec.json`,
  `vitest.config.mts`, `eslint.config.mjs`. Build = `@nx/js/typescript`
  (emitDeclarationOnly), test = `@nx/vitest`. Run tasks via `npm exec nx ...`.
- Every domain entity exposes `from(plain: Plain<T>): T` and `plain(t: T): Plain<T>`.
  `Plain<T>` maps `Brand→base`, `Date→string`, `Option<X>→Plain<X>|null`.
- Row-shape vs `Plain<T>`:
  - **User / Wishlist / Vendor / Category** — `Plain<T>` is already all scalar/nullable;
    the Drizzle row **is** `Plain<T>` 1:1 (`deactivatedAt`/`color` → nullable `text`;
    `published` → `integer({mode:'boolean'})`). `toRow = Entity.plain`,
    `fromRow = Entity.from`.
  - **Item** — needs a real adapter: `price: Money` flattens to
    `price_amount`/`price_currency`; the `_tag` union flattens to one row with nullable
    per-variant columns. Custom `toRow`/`fromRow` on `ItemRepository`.
- Nothing exists yet: no `libs/database`, no drizzle/libsql deps, no NestJS, no `apps/*`.

---

## Phase 0 — Dependencies + lib scaffold

- Add runtime deps: `drizzle-orm`, `@libsql/client`, `@nestjs/common`,
  `reflect-metadata`, `rxjs` (Nest peer). Dev dep: `drizzle-kit`. Pin against the
  installed toolchain (Node 26, TS ~6.0, ESM `nodenext`).
- Scaffold `libs/database` via the `nx-generate` skill (invoke it first), matching the
  `domain` layout exactly: `package.json` (`@wish-list/database`, nx tag `type:database`,
  deps on `@wish-list/domain`, `@wish-list/common-result`, `@wish-list/common-error`),
  the four tsconfigs, `vitest.config.mts` (`name: 'database'`), `eslint.config.mjs`.
- `tsconfig.lib.json` `references`: `../domain`, `../common/result`, `../common/error`
  (their `tsconfig.lib.json`). Add `{ "path": "./libs/database" }` to root `tsconfig.json`.
- `src/index.ts` barrel (filled as phases land).

Directory target:

```
libs/database/
  drizzle.config.ts
  drizzle/                      # generated migrations (committed)
  src/index.ts
  src/lib/
    user/user.schema.ts
    wishlist/wishlist.schema.ts
    item/item.schema.ts
    vendor/vendor.schema.ts
    category/category.schema.ts
    repository/repository.ts
    user/user.repository.ts
    wishlist/wishlist.repository.ts
    item/item.repository.ts
    vendor/vendor.repository.ts
    category/category.repository.ts
    database-failure/database-failure.ts
    database.module.ts
    client/client.ts            # @libsql/client + drizzle() factory
    transaction/transaction.ts
```

## Phase 1 — Schema (US 1–7; ADR-0017)

One `sqliteTable` per `*.schema.ts`. All `id: text('id').primaryKey()`. All timestamps
`text` ISO-8601, set only by the app — **no** `DEFAULT CURRENT_TIMESTAMP` / update trigger.

- **users**: `email` (unique), `name`, `provider`, `providerId`, `plan text{enum:['free','pro']}`,
  `status text{enum:['active','deactivated']}`, `deactivatedAt text` (nullable),
  `createdAt`, `updatedAt`. Unique indexes: `email`; `(provider, providerId)`.
- **wishlists**: `user text → users.id` (`onDelete: cascade`), `name`,
  `slug` (unique), `published integer{mode:'boolean'}`,
  `style text{enum:['default','surprise']}`, timestamps. Index: `user`. Unique: `slug`.
- **items** (single table, ADR-0017): `wishlist → wishlists.id` (`cascade`),
  `vendor → vendors.id` (`restrict`), `category → categories.id` (`restrict`), `url`,
  `status text{enum:['wanted','fulfilled']}`, `tag text{enum:['pending','extracted','failed']}`,
  nullable `name`, `price_amount real`, `price_currency text`, `image text`, `reason text`,
  timestamps. Indexes: `wishlist`, `category`, `vendor`. No SQL `CHECK` — per-tag
  non-nullability is enforced only by `Item.from(row)`.
- **vendors**: `vendorDomain` (unique), `website`, `name`,
  `currency text{enum:['USD','BRL']}`, timestamps. Unique: `vendorDomain`.
- **categories**: `user text → users.id` (index), `name`, `color text` (nullable),
  timestamps. Unique: `(user, name)`. Index: `user`.

## Phase 2 — `Failure.from` extension (unblocks ADR-0018)

In `libs/common/error/src/lib/failure.ts`, add an optional target-name to `from`
(the Failure-input overloads only): when provided, the returned Failure uses that name
and keeps `input` as `.source`; when omitted, behavior is unchanged (inherit source name).
Keep it a single method — no `wrap`/`retag` sibling.

- Update overload signatures + implementation (the two `Failure`-input match arms).
- Add spec cases: `from(failure, meta, 'mapping')` ⇒ `.name === 'mapping'`,
  `.source === failure`, `.toString()` still renders `caused by:`.
- Confirm existing "inherits name from source" spec still passes (name omitted).
- Note the signature change in ADR-0010 / its doc if it documents `from`.

## Phase 3 — DatabaseFailure (US 12–15; ADR-0018)

`src/lib/database-failure/database-failure.ts`:
`export type DatabaseFailure = Failure<'notFound' | 'constraint' | 'query' | 'mapping'>`
plus a `namespace DatabaseFailure` of factories (mirrors `DomainFailure`):

- `notFound(id: Id)` → `Failure.create('notFound', ...)`.
- `constraint(source: Error)` → `Failure.from(source, {...}, 'constraint')`.
- `query(source: Error)` → `Failure.from(source, {...}, 'query')`.
- `mapping(source: DomainFailure)` → `Failure.from(source, {...}, 'mapping')` (Phase 2).

## Phase 4 — Base repository (US 8, 10)

`src/lib/repository/repository.ts` — `abstract class Repository<TEntity, TRow>`
constructed with `{ db, table, toRow(e): TRow, fromRow(row): Result<TEntity, DatabaseFailure> }`:

- `find(id): AsyncResult<TEntity, DatabaseFailure>` — select by id; empty ⇒ `notFound`;
  row ⇒ `fromRow`.
- `insert(entity): AsyncResult<TEntity, DatabaseFailure>` — `toRow` then insert; return entity.
- `update(entity): AsyncResult<TEntity, DatabaseFailure>` — `toRow` then update by id.
- All driver calls via `AsyncResult.fromThrowable` (never `try/catch`). A private
  `translate(err)` maps libsql `SQLITE_CONSTRAINT*` → `constraint`, else → `query`,
  carrying the driver error as `source`.
- `fromRow` wraps `Entity.from` in `Result.fromThrowable` and retags any thrown/returned
  `DomainFailure` via `DatabaseFailure.mapping`.

## Phase 5 — Concrete repositories (US 9, 11)

Each extends the base; list finders return the **full unpaginated** array
(`AsyncResult<TEntity[], DatabaseFailure>`):

- `UserRepository` — base only. `toRow = User.plain`, `fromRow = wrap(User.from)`.
- `WishlistRepository` — `findByUser(user: Id)`. Wishlist plain/from.
- `CategoryRepository` — `findByUser(user: Id)`. Category plain/from.
- `VendorRepository` — `findByVendorDomain(domain: VendorDomain)`. Vendor plain/from.
- `ItemRepository` — `findByWishlist(wishlist: Id)`. **Custom mappers**: `toRow`
  flattens `Money`→`price_amount`/`price_currency` and spreads the `_tag` variant into
  nullable columns; `fromRow` reassembles `price` + selects the variant shape by `tag`,
  builds a `Plain<Item>`, then `Item.from` (mapping-retagged on failure).

## Phase 6 — Connection + DatabaseModule (US 16, 17)

- `client/client.ts` — `createClient({ url })` from `DATABASE_URL`, wrapped in
  `drizzle(...)`. One code path: `file:./local.db` locally, `libsql://…` for Turso —
  differs only by env var.
- `database.module.ts` — Nest `DatabaseModule` (`@Module`) reading `DATABASE_URL` from
  config/env, providing the drizzle client + every repository as injectable tokens,
  exporting them. Feature `service` modules import `DatabaseModule`.

## Phase 7 — Transaction helper (US 18)

`transaction/transaction.ts` — `Database.transaction<T>(fn: (tx) => Promise<T>):
AsyncResult<T, DatabaseFailure>` over the libsql/drizzle transaction API; commit on
success, roll back on throw, translate failures to `DatabaseFailure`. (Primitive only —
the account signup flow that first uses it is out of scope.)

## Phase 8 — Migrations (US 19, 20)

- `libs/database/drizzle.config.ts` — schema glob `src/lib/**/*.schema.ts`, dialect
  `turso`/`sqlite`, `out: 'drizzle'`.
- Scripts: `db:generate` (`drizzle-kit generate`, schema-diff, committed) and
  `db:migrate` (explicit `drizzle-kit migrate`). **Never** `drizzle-kit push`, **never**
  auto-run on API boot.

## Phase 9 — Tests (Testing Decisions)

- Real local libsql file; a setup applies migrations before the suite (mocked client
  is explicitly rejected).
- Per repository: insert→find round-trip deep-equals the original entity; `find` on a
  missing id ⇒ `DatabaseFailure` `notFound`; duplicate unique (e.g. `email`) ⇒
  `constraint`.
- `Item`: round-trip each of the three tags (pending/extracted/failed), asserting the
  Money flatten and per-tag columns rebuild correctly.
- `Database.transaction`: force the 2nd of two writes to fail; assert the 1st rolled back.
- `DatabaseModule`: smoke test — instantiate against a local file DB, resolve every
  repository token.
- `Failure.from` name-override cases (Phase 2).

## Sequencing / dependencies

- P0 → P1 (schema needs the lib).
- **P2 is independent** (only touches `common-error`) and gates P3's `mapping`/`constraint`/`query`.
- P3 + P1 → P4 → P5.
- P5 + P6 → P7; P1 → P8; everything → P9.
- P2, and P1-vs-P0-scaffold, can proceed in parallel with early Nest wiring.

## Risks / watch-items

- **Boolean storage**: `wishlists.published` must use `integer({mode:'boolean'})` so the
  drizzle row yields a JS `boolean` matching `Plain<Wishlist>.published` — otherwise the
  round-trip deep-equal fails.
- **Money precision**: `real` for `price_amount` is float; fine for the current domain
  (`z.number().nonnegative().finite()`), revisit if minor-units/decimal exactness is
  later required.
- **libsql error codes**: confirm the exact constraint-error shape `@libsql/client`
  surfaces (code string vs message) so `translate()` classifies `constraint` vs `query`
  reliably — pin this in a test.
- **First Nest in the workspace**: no `apps/*` yet, so `DatabaseModule` is validated only
  by the smoke test until an app consumes it.
```

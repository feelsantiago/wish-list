# Wish List

Multi-user SaaS for tracking desired items scraped from arbitrary retailer websites — organize them, apply coupons, track prices.

Paste a product URL, system scrapes name/price/image/currency automatically (structured data first, LLM fallback), item lands in a Wishlist. No per-vendor scrapers, no manual entry required (though user can correct fields after the fact).

Nx monorepo, TypeScript, npm workspaces. Backend-first build — domain model, database layer, and extraction pipeline are done; API/web apps not scaffolded yet (see [Status](#status)).

## Core concepts

Full glossary lives in [`CONTEXT.md`](./CONTEXT.md). Short version:

- **User** — account holder (OAuth), owns Wishlists/Categories/Plan. `Active`/`Deactivated`, never hard-deleted.
- **Plan** — `Free` or `Pro`. Free = manual Coupons. Pro = Coupon Rule engine + auto Price Tracking.
- **Wishlist** — named collection of Items, owned by one User, independently shareable.
- **Item** — a product wanted, captured by URL. `Wanted`/`Fulfilled` status. One Wishlist, one Category, one Vendor.
- **Extraction** — one recorded attempt to read a product page. Append-only, global (not per-user), reused when fresh enough instead of re-fetched.
- **Vendor** — retailer, derived from the URL's registrable domain on first sight. `provisional` (domain only) → `resolved` (name + currency known, from a successful Extraction). Never merged across TLDs (`amazon.com` ≠ `amazon.com.br`).
- **Category** — user-defined label, global across a User's Wishlists. Everyone gets an `Unsorted` default at signup.
- **Coupon** / **Coupon Rule** — manual discount code (Free) vs. auto-matching rule by price threshold (Pro). Never stored on the Item — Effective Price is computed fresh each read.
- **Currency** — whatever the price was scraped in. Never converted.
- **Sharing** / **Reservation** — Wishlist gets a stable unlisted link; Pro viewers can reserve an Item so others see it's spoken for. Per-Wishlist "Surprise Mode" controls whether the owner sees Reservations.
- **Tracked Item** / **Price History** — Pro opt-in daily price fetch, appended to a per-user history series.

## Features

**Built:**
- Domain model for the full glossary above (branded value types, entities, invariants) — `libs/domain`
- Persistence layer — Drizzle/Turso schema + repositories for every entity — `libs/database`
- Extraction pipeline — `libs/extraction`:
  - Structured-data reading first (JSON-LD `schema.org/Product`, OpenGraph/`product:price:*` meta tags) — no LLM call on the common path
  - LLM fallback (via Vercel AI SDK, Anthropic) when structured data is missing/incomplete
  - Vendor find-or-create + provisional→resolved promotion
  - Extraction reuse: fresh successful/failed records are served from the DB instead of re-fetching, with separate freshness windows for success vs. failure
  - In-flight de-dup so concurrent requests for the same URL share one fetch (`InFlightCache`)
  - Page fetch + LLM budget bounded by a shared timeout

**Not yet built (see `docs/adr` for design):**
- `apps/api` — NestJS HTTP API (controllers live here per ADR-0025, not in service libs)
- `apps/web` — Angular frontend
- Per-feature `service`/`data`/`ui` libs (`wishlist`, `item`, `category`, `coupon`, `sharing`, `tracking`, `account`) — scaffolded on demand, not up front (ADR-0004)
- Auth (OAuth), billing/Plan enforcement
- Coupon Rule matching engine, Effective Price computation
- Sharing links, Reservations, Surprise Mode
- Scheduled price tracking job

## Project structure

```
libs/
  common/
    result/      Result / Option / AsyncResult — no throw, no null (ADR-0005)
    error/       Failure — universal tagged error type + renderers (ADR-0010, ADR-0011)
    utils/       framework-agnostic helpers (URL normalization, InFlightCache, withTimeout)
  domain/        DDD layer — branded types, entities, business rules, zero framework deps
  database/      Drizzle schema, Turso/libsql client, repositories (one per entity)
  extraction/    page fetch, structured-data + LLM extraction, Vendor lifecycle

apps/            (not created yet — apps/api, apps/web to come)

docs/
  adr/           architecture decisions, numbered, immutable once accepted
  prd/           product requirements per entity/slice
```

Dependency direction (enforced by `@nx/enforce-module-boundaries` tags, not just convention):

```
apps/api  → libs/<feature>/service → libs/domain, libs/database, libs/extraction, libs/<feature>/data
apps/web  → libs/<feature>/ui      → libs/<feature>/data
libs/extraction → libs/domain, libs/database
libs/database   → libs/domain
libs/domain     → libs/common
```

- `libs/domain` never imports NestJS or Angular — the one layer both future apps share unmodified.
- `libs/domain` is the ubiquitous language: every other lib derives its types from domain types, never restates them.
- Services never import other services — cross-feature reads go through `libs/database` repositories directly; a feature's service only *writes* its own entities (ADR-0025).
- Controllers live in `apps/api`, not in service libs, so services stay usable from a CLI/cron/queue worker unchanged.

See ADR-0003 (tooling), ADR-0004 (feature-based layout, amended by ADR-0025) for the full rationale.

## Code style

Enforced by convention + review, see [`CLAUDE.md`](./CLAUDE.md):

- No `try`/`catch` in `libs/domain` or anywhere `Result` is idiomatic — use `Result.fromThrowable`, chain `.map`/`.mapErr`/`.unwrapOr`.
- No `switch` on discriminated unions — use `ts-pattern`'s `match(...).with(...).exhaustive()`.
- No `if`/`else`/ternary branching on a value's type or shape — prefer `ts-pattern`.
- No bare `null`/`undefined` — use `Option` from `@wish-list/common-result`.
- No top-level helper functions in files exporting a class — put them as `private` methods.
- No loose `Failure.create`/`Failure.from` calls or repeated inline `Failure<'a' | 'b'>` unions — each failure type gets its own file exporting a type alias plus a same-named namespace of factory functions (e.g. `ReadingFailure.noStructuredData()`).

## Requirements

- Node ≥ 22 (repo built against Node 26)
- npm (npm workspaces, not pnpm/yarn — see ADR-0003)

## Setup

```sh
npm install
```

Database layer needs a Turso/libsql connection for anything beyond in-memory tests:

```sh
# libs/database/.env (or export directly)
DATABASE_URL=file:./local.db        # or libsql://<db>.turso.io for real Turso
DATABASE_AUTH_TOKEN=...             # only needed for remote Turso
```

## Commands

Always run through Nx (`nx run`, `nx run-many`, `nx affected`), not the underlying tool directly.

```sh
# run a target for one project
npx nx run <project>:<target>       # e.g. npx nx run domain:test

# run a target across every affected project
npx nx affected -t test
npx nx affected -t lint
npx nx affected -t build

# run a target everywhere
npx nx run-many -t test

# typecheck
npx nx run <project>:typecheck

# explore the project graph
npx nx graph
```

Database schema (from `libs/database`):

```sh
npx nx run database:db:generate     # drizzle-kit generate — new migration from schema changes
npx nx run database:db:migrate      # drizzle-kit migrate — apply migrations
```

Keep TypeScript project references in sync (usually automatic on `build`/`typecheck`):

```sh
npx nx sync         # fix references
npx nx sync:check   # verify in CI, no fix
```

## Testing

Vitest everywhere (`@nx/vitest`), including NestJS modules via `@nestjs/testing`. No test hits a real retailer or a real model — extraction specs fake `PageFetcher`/`Llm` at the port boundary and assert call counts/behavior, not network traffic. Time-dependent specs (freshness windows, in-flight dedup) use `vi.useFakeTimers()`, not real sleeps.

## License

[PolyForm Noncommercial 1.0.0](./LICENSE). Source visible, use permitted for noncommercial purposes only — no commercial/revenue-generating use without a separate license from the author.

## Documentation

- [`CONTEXT.md`](./CONTEXT.md) — domain glossary, the source of truth for terminology
- [`docs/adr/`](./docs/adr) — architecture decisions (numbered, sequential, read in order for history)
- [`docs/prd/`](./docs/prd) — product requirements per entity/slice

# Implementation Plan — 0012 Extraction Layer

No companion PRD. This plan introduces `libs/extraction` (`@wish-list/extraction`),
the first non-persistence service layer in the workspace, and carries three
prerequisite refactors of existing libs that it forces.

Scope was deliberately re-sequenced during design: the original intent was to build
`libs/item/{data,service,ui}` first. Extraction was pulled ahead because it holds all
the genuine unknowns (external fetch, LLM, caching policy, Vendor lifecycle), has no
cross-entity relationship dependencies, and `ItemService.create` cannot be written
until it exists. The Item slice is the next iteration.

## Resolved decisions

1. **Feature libs are named `data` / `service` / `ui`**, per ADR-0004 — not `module`.
   `module` names the framework artifact (one `@Module` class), not the lib's
   responsibility, and would collide with `DatabaseModule`/`ExtractionModule` in prose.

2. **`libs/extraction` is a horizontal single lib, not a `data`/`service`/`ui` trio.**
   The trio exists so a feature's client and server halves can share DTOs across the
   API seam. Extraction has no client half — nothing in Angular calls it — and its
   data types are domain entities that already live in `libs/domain`. It is
   infrastructure, same category as `libs/database`.

3. **Controllers live in `apps/api`, not in feature `service` libs.** Service libs are
   API-agnostic: no HTTP vocabulary, no Nest controllers, no status-code mapping.
   This contradicts ADR-0004's description of `service` ("NestJS modules, controllers,
   application services") and requires an amendment.

4. **Layers communicate through domain types.** `libs/domain` is the ubiquitous
   language of the system; every other lib derives its own types from domain types
   rather than restating them. `libs/extraction` therefore depends on `libs/domain`
   and returns domain entities, not raw primitives.

5. **Failure names are kebab-case workspace-wide.** `DatabaseFailure`'s existing
   `'notFound'` is the only violation and gets refactored (Phase 0).

6. **`ServiceFailure` is a generic, extensible service-layer failure vocabulary**,
   exported from a `@wish-list/common-error/service` subpath (mirroring the existing
   `renderers` subpath). Each service unions its own names onto it. It carries no HTTP
   knowledge.

7. **Repository capabilities are interfaces + composition, not inheritance.**
   `Readable`/`Insertable`/`Updatable`/`Deletable` interfaces; shared implementations
   are free functions over a `RepositoryOptions` object; each repository declares
   exactly the capabilities it has. An append-only repository has no `update` in its
   type at all — a compile error, not a runtime throw.

8. **`Vendor` becomes a `provisional | resolved` discriminated union** (ADR-0008
   pattern). A Vendor is derivable from a URL alone, but its `name` and `currency` are
   only knowable after a successful extraction. `Item.vendor: Id` stays required in
   every Item state.

9. **`libs/extraction` owns the Vendor lifecycle.** `CONTEXT.md` defines Vendor as
   "derived automatically from the URL's registrable domain the first time it's seen…
   Not a curated allowlist" — there is no user-facing Vendor creation flow, and
   extraction is the only component that ever learns a Vendor's name and currency.
   Consequence: `libs/vendor/*` is dropped from ADR-0004's initial slice list; it will
   likely never exist.

10. **A feature's `service` may use any repository; services never import other
    services.** ADR-0004's "cross-feature calls go through the other feature's service
    lib's public API" was written assuming per-feature database libs, which is not what
    got built — all repositories live in one `libs/database` that `service` is already
    allowed to import wholesale, so the rule was never lint-enforceable. Replacing it
    with "no service→service edges" makes the dependency graph a DAG by construction
    and avoids `forwardRef` cycles (`item/service` ↔ `wishlist/service`) on day one.
    Convention on top: a feature's service owns _writes_ to its own entities; other
    features may _read_ any repository.

11. **Extraction is all-or-nothing.** `Item.ExtractionData` requires `price: Money`,
    so a page yielding name+image but no price is a failed extraction, not a partial
    success. Revisitable if "see price in cart" retailers turn out to matter.

12. **A failed extraction is a recorded outcome, not an `Err`.** `Extractor.extract`
    returns `AsyncResult<Extraction, ExtractionFailure>` where `Extraction` is a
    `succeeded | failed` union and the `Err` branch is reserved for infrastructure
    breakage. A blocked retailer is normal, expected, audited, retryable — and the
    caller still needs the Vendor `Id` it carries, which an `Err` cannot deliver.

13. **`Extraction` records are append-only, one row per attempt.** "Audit" and "update
    in place" are contradictory. Append-only also lets a future retry queue see
    `blocked` five times on one key and back off, which a single mutable row cannot
    express.

14. **Reuse is a two-method API, not a per-call parameter.** `extract(url)` reuses a
    fresh record; `refresh(url)` always hits the network. Tracking's daily price fetch
    must use `refresh` or it would record the same price forever. Freshness windows are
    module configuration, not call arguments.

15. **Failed extractions are reused too** (negative caching), on a much shorter window.
    Without it, a script POSTing one bot-walled URL repeatedly triggers one outbound
    fetch per request. Rate limiting caps the caller; negative caching caps the
    outbound blast radius. `'unsupported-currency'` is permanent — never re-attempted.

16. **`PageFetcher` and `Llm` are ports with injection tokens.** ADR-0016 rejected port
    abstractions for _repositories_ on the grounds that nothing needed swapping; both of
    these have a concrete, near-term swap (plain `fetch` → reader API when retailers
    block; AI SDK → any other client), which is exactly ADR-0016's stated trigger. The
    JSON-LD/OpenGraph parsers stay pure functions — nothing to swap, no port.

17. **The LLM's zod schema is lenient, not the domain schema.** If `Currency.$` is in
    the schema handed to the model, a GBP page gets coerced into `"USD"` to satisfy it
    and a wrong-currency price is stored silently. A lenient schema plus explicit
    domain conversion turns that into a clean `'unsupported-currency'` outcome. Internal
    to the lib; the public surface still returns domain types.

18. **Structured data is tried before the LLM.** JSON-LD `schema.org/Product`, then
    OpenGraph, then the LLM path. ADR-0001 rules out _per-vendor_ parsers; these are
    generic web standards with the same "works on any site, no per-vendor maintenance"
    property, so this complements ADR-0001 rather than contradicting it. It is also the
    single largest lever on both latency and spend.

## Baseline facts (verified)

- Workspace: Nx 23 TS-solution + npm workspaces, globs `apps/*`, `libs/*`, `libs/*/*`.
  Existing libs: `libs/common/{result,error}`, `libs/domain`, `libs/database`. No
  `apps/*`. No Angular. Root `tsconfig.json` lists each lib in `references`.
- Per-lib layout (copy from `libs/database`): `package.json` (`@wish-list/<x>`,
  `type: module`, `exports` → `src/index.ts`, `nx.name`, `nx.tags`), `tsconfig.json`,
  `tsconfig.lib.json` (project-refs its dependency libs), `tsconfig.spec.json`,
  `vitest.config.mts`, `eslint.config.mjs`.
- `libs/database` has 10 repositories, all `extends Repository<TEntity, TRow, TTable>`
  which exposes `find`/`insert`/`update` unconditionally. `PriceHistoryRepository` is
  append-only by nature (its domain namespace has no mutating function) yet exposes
  `update` today — a live correctness bug this plan fixes.
- `drizzle.config.ts` globs `libs/database/src/lib/**/*.schema.ts` — one migration
  source for the workspace. Any new table lives in `libs/database`.
- `DatabaseFailure` = `Failure<'notFound' | 'constraint' | 'query' | 'mapping'>`.
  `'notFound'` is constructed in two places: `database-failure.ts` and inline in
  `vendor.repository.ts` (`Failure.create('notFound', …)`).
- `libs/common/error` exports `Failure` from `src/index.ts` and
  `FailureRenderer`/`ConsoleRenderer` from `src/renderers.ts` — the subpath precedent
  `ServiceFailure` will follow.
- `Currency = 'USD' | 'BRL'`, a closed union. `Money = { amount: number; currency: Currency }`.
- `Vendor` today is a flat interface `{ id, vendorDomain, website, name, currency,
createdAt, updatedAt }` with a single `Vendor.create` requiring all fields.
- `VendorDomain` validates a **hostname** via `magic-regexp`. It does **not** compute a
  registrable domain — `www.amazon.com` and `amazon.com` are distinct values today, and
  `amazon.com.br` cannot be reduced to eTLD+1 without a public-suffix list. `CONTEXT.md`
  specifies registrable domain. This is a real gap; see Phase 3.
- `Item` is a `pending | extracted | failed` union with `vendor: Id` required on
  `BaseItem`. `Item.ExtractionData = { name: string; price: Money; image: Url }`.

## Explicitly out of scope

Deferred to later iterations, named here so they aren't silently assumed:

- **`libs/item/{data,service}`** — next iteration.
- **Retry queue** for failed extractions. Records are written with enough information
  (`key`, `reason`, attempt history) for a queue to consume later; nothing consumes them
  in this plan.
- **Rate limiting** (per-IP/per-user request ceiling, `@nestjs/throttler`) — API-layer,
  lands with `apps/api`.
- **Request idempotency** (same POST twice → one Item) — distinct from extraction reuse,
  API-layer, lands with the Item slice.
- **`apps/api`**, controllers, HTTP status mapping, `libs/item/ui`, Angular.
- **`CategoryRepository.findUnsorted`** and the `Unsorted` Category marker — needed by
  `ItemService.create`, not by extraction.
- **Item domain gaps** found during design and not addressed here: no status transition
  (`Item.fulfil`), no `Item.categorize`, and deletion is undefined in `CONTEXT.md`,
  in `libs/domain`, and in the schema.

---

## Phase 0 — Kebab-case failure names

Mechanical rename across `libs/database`, independent of every other phase.

- `DatabaseFailureType`: `'notFound'` → `'not-found'`.
- `DatabaseFailure.notFound` factory body: `Failure.create('not-found', …)`. The
  _function_ name stays `notFound` (it's a TS identifier, camelCase is correct there);
  only the failure's runtime name string changes.
- `vendor.repository.ts` inline `Failure.create('notFound', 'Entity not found', …)` →
  `'not-found'`. Better: replace it with `DatabaseFailure.notFound`-style construction
  so the string exists in exactly one place.
- Update `database-failure.spec.ts` and any repository spec asserting on `.name`.

Verify: `npm exec nx run-many -t test lint typecheck -p database`.

## Phase 1 — `ServiceFailure` in `libs/common/error`

New file `libs/common/error/src/lib/service-failure.ts`, new entrypoint
`libs/common/error/src/service.ts`, exposed as the `./service` export condition in
`package.json` alongside the existing `./renderers` pattern.

```ts
export type ServiceFailureType =
  | 'not-found' // requested entity does not exist
  | 'invalid' // input failed domain validation
  | 'forbidden' // actor is not permitted (ownership)
  | 'plan-required' // gated behind a Plan the actor lacks (ADR-0012)
  | 'conflict' // operation contradicts current state
  | 'unexpected'; // infrastructure failure

export type ServiceFailure<T extends string = never> = Failure<
  ServiceFailureType | T
>;

export namespace ServiceFailure {
  export function notFound(id: string): Failure<'not-found'>;
  export function invalid(source: Failure): Failure<'invalid'>;
  export function forbidden(
    actor: string,
    resource: string,
  ): Failure<'forbidden'>;
  export function planRequired(feature: string): Failure<'plan-required'>;
  export function conflict(reason: string): Failure<'conflict'>;
  export function unexpected(source: Error): Failure<'unexpected'>;
}
```

Notes:

- `plan-required` is a first-class variant because Plan is a first-class `CONTEXT.md`
  term gating Coupon Rule, Reservation, and Tracking. It is distinct from `forbidden`
  ("you don't own this Wishlist") and is not an HTTP concern.
- `unexpected` collapses all three infrastructure `DatabaseFailure` names
  (`constraint`/`query`/`mapping`). Services above do not need to reason about database
  failure modes; the `source` chain preserves the detail for logs.
- A service extends by unioning its own names, and does **not** re-export the generic
  factories:

```ts
export type ExtractionFailureType = 'persist-failed' | 'misconfigured';
export type ExtractionFailure = ServiceFailure<ExtractionFailureType>;
export namespace ExtractionFailure {
  /* only its own factories */
}
```

Tests: name/metadata/`source`-chain assertions mirroring `failure.spec.ts`.

## Phase 2 — Repository capabilities refactor

Replaces the `Repository` base class across all 10 existing repositories.

**Capability interfaces** — `libs/database/src/lib/repository/capability.ts`:

```ts
export interface Readable<TEntity> {
  find(id: Id): AsyncResult<TEntity, DatabaseFailure>;
}
export interface Insertable<TEntity> {
  insert(entity: TEntity): AsyncResult<TEntity, DatabaseFailure>;
}
export interface Updatable<TEntity> {
  update(entity: TEntity): AsyncResult<TEntity, DatabaseFailure>;
}
export interface Deletable<TEntity> {
  delete(id: Id): AsyncResult<void, DatabaseFailure>;
}
```

**Shared implementations as free functions** — `libs/database/src/lib/repository/operation.ts`:

```ts
export interface RepositoryOptions<TEntity, TRow extends { id: string }, TTable extends RepositoryTable> {
  readonly db: LibSQLDatabase;
  readonly table: TTable;
  readonly mapper: DomainMapper<TEntity, TRow>;
}

export function find<...>(options: RepositoryOptions<...>, id: Id): AsyncResult<TEntity, DatabaseFailure>;
export function insert<...>(options: RepositoryOptions<...>, entity: TEntity): AsyncResult<TEntity, DatabaseFailure>;
export function update<...>(options: RepositoryOptions<...>, entity: TEntity): AsyncResult<TEntity, DatabaseFailure>;
export function remove<...>(options: RepositoryOptions<...>, id: Id): AsyncResult<void, DatabaseFailure>;
```

Bodies lift verbatim from the current `Repository` methods. Free functions rather than
helper classes: identical explicitness and compile-time gating, no duplicated
`db`/`table`/`mapper` state across 1–3 helper instances per repository, and consistent
with how `libs/domain` models behaviour (namespaces over plain functions, ADR-0007).

**Each repository declares its capabilities:**

```ts
@Injectable()
export class ItemRepository
  implements Readable<Item>, Insertable<Item>, Updatable<Item>
{
  private readonly options: RepositoryOptions<Item, ItemRow, typeof items>;

  public constructor(
    @Inject(DATABASE_CLIENT) db: LibSQLDatabase,
    mapper: ItemDatabaseDomainMapper,
  ) {
    this.options = { db, table: items, mapper };
  }

  public find(id: Id) {
    return find(this.options, id);
  }
  public insert(entity: Item) {
    return insert(this.options, entity);
  }
  public update(entity: Item) {
    return update(this.options, entity);
  }

  public findByWishlist(wishlist: Id) {
    /* own query, uses this.options */
  }
}
```

Capability assignment:

| Repository                                                              | Readable | Insertable | Updatable | Deletable |
| ----------------------------------------------------------------------- | :------: | :--------: | :-------: | :-------: |
| User, Wishlist, Category, Vendor, Item, Coupon, CouponRule, TrackedItem |    ✓     |     ✓      |     ✓     |           |
| PriceHistory                                                            |    ✓     |     ✓      |           |           |
| Reservation                                                             |    ✓     |     ✓      |           |     ✓     |
| Extraction (Phase 5)                                                    |    ✓     |     ✓      |           |           |

`PriceHistory` losing `update` is the correctness fix. `Reservation` gets `Deletable`
per ADR-0015 (cancel = match token, then delete) — note this is the case a linear
inheritance chain could not have expressed, and the reason for the composition approach.

Delete `repository.ts`'s abstract class. `Repositories` (the aggregator) is unchanged.
Update `src/index.ts` exports.

Verify: full `libs/database` suite green, no behavioural change.

## Phase 3 — `Vendor` provisional/resolved + registrable domain

**Registrable domain first.** Add `tldts` as a dependency and give `VendorDomain` a
`fromUrl(url: Url): Result<VendorDomain, DomainFailure>` that resolves eTLD+1 via the
public suffix list. Without it `www.amazon.com` and `amazon.com` produce two Vendors,
and `amazon.com.br` cannot be reduced correctly — both contradict `CONTEXT.md`. The
existing hostname regex stays as the shape validator for `VendorDomain.create`.

**Domain change** — `libs/domain/src/lib/vendor/vendor.ts`:

```ts
interface BaseVendor {
  readonly id: Id;
  readonly vendorDomain: VendorDomain;
  readonly website: Url;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
export interface ProvisionalVendor extends BaseVendor {
  readonly _tag: 'provisional';
}
export interface ResolvedVendor extends BaseVendor {
  readonly _tag: 'resolved';
  readonly name: string;
  readonly currency: Currency;
}
export type Vendor = ProvisionalVendor | ResolvedVendor;

export namespace Vendor {
  export interface ExtractionData {
    readonly name: string;
    readonly website: Url;
    readonly currency: Currency;
  }
  export function provisional(input: {
    vendorDomain: VendorDomain;
    website: Url;
  }): ProvisionalVendor;
  export function resolve(
    vendor: Vendor,
    data: Vendor.ExtractionData,
  ): Result<ResolvedVendor, DomainFailure>;
  export function isProvisional(v: Vendor): v is ProvisionalVendor;
  export function isResolved(v: Vendor): v is ResolvedVendor;
  // from/plain rewritten as ts-pattern matches over _tag, per Item's shape
}
```

`Vendor.ExtractionData` carries `currency` even though it duplicates
`Item.ExtractionData.price.currency` — same value, and the snapshot is the point.

**Persistence** — `vendor.schema.ts` follows ADR-0017's single-table mapping: add a
`_tag` column, make `name`/`currency` nullable. Migration via `drizzle-kit generate`.
`vendor.mapper.ts` stops using the generic `DatabaseDomainMapper.create(Vendor.plain,
Vendor.from)` and becomes a bespoke `VendorDatabaseDomainMapper` with `ts-pattern`
matches in both directions, exactly like `ItemDatabaseDomainMapper`.

**Consequence to accept:** a `Coupon` or `CouponRule` cannot attach to a provisional
Vendor — they need its `Currency` (ADR-0014). Enforced by the type. Both are Pro
features landing later, so nothing breaks today.

## Phase 4 — `Extraction` domain entity

`libs/domain/src/lib/extraction/` — new entity, ADR-0008 union, append-only (no
mutating function in the namespace).

```ts
export type ExtractionKey = Brand<string, 'ExtractionKey'>;
export type ExtractionSource = 'json-ld' | 'opengraph' | 'llm';
export type ExtractionReason =
  | 'fetch-failed'
  | 'blocked'
  | 'timeout'
  | 'no-data'
  | 'unsupported-currency'
  | 'llm-failed';

interface BaseExtraction {
  readonly id: Id;
  readonly key: ExtractionKey;
  readonly url: Url;
  readonly vendor: Id; // always present — provisional or resolved
  readonly createdAt: Date;
}
export interface SucceededExtraction extends BaseExtraction {
  readonly _tag: 'succeeded';
  readonly source: ExtractionSource;
  readonly data: Item.ExtractionData;
  readonly vendorData: Vendor.ExtractionData; // snapshot; vendors row gets overwritten
}
export interface FailedExtraction extends BaseExtraction {
  readonly _tag: 'failed';
  readonly reason: ExtractionReason;
}
export type Extraction = SucceededExtraction | FailedExtraction;
```

**`ExtractionKey` normalization** — `libs/domain/src/lib/extraction/extraction-key.ts`.
The load-bearing part: `amazon.com/dp/B0XYZ?tag=aff-20` and `amazon.com/dp/B0XYZ` must
produce the same key or reuse rate collapses. Proposed rules, open to revision:

1. lowercase scheme + host; drop a leading `www.`
2. drop the fragment
3. drop tracking params: `utm_*`, `tag`, `ref`, `ref_`, `gclid`, `fbclid`, `mc_*`,
   `_encoding`, `psc`, `th`
4. sort remaining query params by name
5. strip a trailing `/` from the path
6. force `https`

Deliberately _not_ done: stripping all query params. Many retailers encode the actual
variant (size, colour, SKU) in the query, and collapsing those would return the wrong
product's price. Conservative stripping with a named denylist is the safer default; the
denylist can grow as real URLs are observed.

Round-trip `from`/`plain` tests per ADR-0007/0009, plus a normalization table test.

**`CONTEXT.md` additions:** `Extraction` (the record), `Extraction Key`; amend `Vendor`
to describe provisional vs resolved; note under `Item` that two Users saving the same
URL get two independent Items (no shared entity, no many-to-many).

## Phase 5 — `extractions` table + `ExtractionRepository`

In `libs/database`, following Phase 2's capability model.

- `extraction.schema.ts`: `id` PK, `key` text, `url` text, `vendor` text FK →
  `vendors.id`, `_tag`, `source` (nullable enum), `reason` (nullable enum), flattened
  `data_*` and `vendor_data_*` columns (nullable, per-variant — ADR-0017),
  `created_at` ISO text. **Index on `(key, created_at)`** — not a unique index; the
  table is append-only and the hot query is "latest row for key".
- `extraction.mapper.ts`: bespoke `ExtractionDatabaseDomainMapper`, `ts-pattern` both
  directions (union + nested `Money`), same shape as `ItemDatabaseDomainMapper`. Not
  exported from `src/index.ts` — bespoke mappers are repository-internal.
- `extraction.repository.ts`: `implements Readable<Extraction>, Insertable<Extraction>`
  plus `findLatestByKey(key: ExtractionKey): AsyncResult<Extraction, DatabaseFailure>`.
  No `update`, no `delete` — not on the type.
- Register in `database.module.ts` (providers + exports) and in `Repositories`.
- `drizzle-kit generate`, commit the migration.
- Real-db repository spec following the existing `*.repository.spec.ts` pattern.

## Phase 6 — `libs/extraction` scaffold + ports

Scaffold via the `nx-generate` skill, matching `libs/database`'s layout.

```
libs/extraction/
  package.json          @wish-list/extraction, nx.name "extraction", tags ["type:extraction"]
  src/index.ts
  src/lib/
    extraction.module.ts
    extraction-failure.ts
    fetcher/{page-fetcher.ts,http.page-fetcher.ts}
    llm/{llm.ts,vercel-ai.llm.ts,prompt.ts}
    structured/{json-ld.ts,opengraph.ts,markdown.ts}
    vendor/vendor-resolver.ts
    extractor.ts
```

Dependencies: `@wish-list/domain`, `@wish-list/database`, `@wish-list/common-result`,
`@wish-list/common-error`, `@nestjs/common`, `zod`, `ts-pattern`, `tldts`, `cheerio`
(HTML parse/prune + JSON-LD/meta extraction), `node-html-markdown`, `ai`,
`@ai-sdk/anthropic`. Add `{ "path": "./libs/extraction" }` to root `tsconfig.json` and
project references to `tsconfig.lib.json`.

**Ports:**

```ts
export interface PageFetcher {
  fetch(
    url: Url,
  ): AsyncResult<string, Failure<'fetch-failed' | 'blocked' | 'timeout'>>;
}
export const PAGE_FETCHER = Symbol('PAGE_FETCHER');

export interface Llm {
  generate<T>(
    schema: z.ZodType<T>,
    prompt: string,
  ): AsyncResult<T, Failure<'llm-failed'>>;
}
export const LLM = Symbol('LLM');
```

`HttpPageFetcher`: plain `fetch` with a browser `User-Agent`, `AbortController`
deadline, `403`/`429`/captcha-body detection → `'blocked'`. A reader-API
implementation is the planned later swap; no caller changes when it lands.

## Phase 7 — Structured parsers (no LLM)

Pure functions, no DI, no ports.

- `json-ld.ts` — collect every `<script type="application/ld+json">`, walk `@graph`
  and arrays, find `@type: 'Product'`, read `name`, `image`, `offers.price`,
  `offers.priceCurrency`. Handle `offers` being an array or an `AggregateOffer`.
- `opengraph.ts` — `og:title`, `og:image`, `og:site_name`, `product:price:amount`,
  `product:price:currency`, plus `twitter:*` fallbacks.
- Both return a lenient shape (`{ name?, price?, currency?, image?, vendorName? }`);
  the orchestrator decides whether it's complete enough to skip the LLM.

Test against captured HTML fixtures from a handful of real retailers, committed under
`src/lib/structured/__fixtures__/`.

## Phase 8 — LLM path

- `markdown.ts` — prune the DOM (drop `script`/`style`/`nav`/`footer`/`svg`/`iframe`/
  `noscript`, keep `<head>` meta + main content), convert with `node-html-markdown`,
  truncate to a configured byte cap (~40KB).
- `prompt.ts` — lenient zod schema, deliberately **not** the domain schema:

```ts
const extraction$ = z.object({
  name: z.string(),
  price: z.number(),
  currency: z.string(), // NOT Currency.$ — the page may legitimately say GBP
  image: z.string(),
  vendorName: z.string(),
});
```

- `vercel-ai.llm.ts` — `generateObject` with `anthropic('claude-haiku-4-5')`.
  Structured extraction from pre-reduced markdown is an easy task; Haiku is what makes
  a ~3s inline budget realistic. Sonnet is the escalation, and under the port it's a
  config change.
- Domain conversion happens after the port returns: `Currency.$.safeParse` failure →
  `'unsupported-currency'` (permanent), `Money.create`/`Url.create` failure →
  `'no-data'`.

## Phase 9 — `Extractor` orchestration

```ts
@Injectable()
export class Extractor {
  extract(url: Url): AsyncResult<Extraction, ExtractionFailure>; // reuse if fresh
  refresh(url: Url): AsyncResult<Extraction, ExtractionFailure>; // always fetch
}
```

`extract(url)`:

```
key = ExtractionKey.from(url)
latest = ExtractionRepository.findLatestByKey(key)
  succeeded && age < freshness                    → return it
  failed && reason === 'unsupported-currency'     → return it (permanent)
  failed && age < failureWindow                   → return it (negative cache)
  otherwise                                        → fall through to refresh
```

`refresh(url)` — bypasses both windows:

```
vendorDomain = VendorDomain.fromUrl(url)
vendor       = VendorRepository.findByVendorDomain(...) ?? insert(Vendor.provisional(...))
                                                          ← always exists before fetching
pipeline under one deadline (budget, default 3000ms):
  PageFetcher.fetch(url)
    → json-ld  complete? ─────────────────┐
    → opengraph complete? ────────────────┤→ succeeded
    → prune + markdown + Llm.generate ────┘
  convert to domain types
succeeded → Vendor.resolve(vendor, vendorData) + update  → insert SucceededExtraction
failed    → vendor stays provisional                     → insert FailedExtraction
insert fails → Err(ExtractionFailure.persistFailed(...))
```

**In-flight dedup:** a `Map<ExtractionKey, Promise<...>>` inside `Extractor`. A second
caller for a key with an open request awaits the first rather than issuing its own.
~15 lines, no infrastructure, and it closes the concurrent-burst hole that the
persisted windows cannot.

**Module options:**

```ts
export interface ExtractionModuleOptions {
  readonly freshness: number; // reuse succeeded rows newer than this — default 24h
  readonly failureWindow: number; // reuse failed rows newer than this — default 5min
  readonly budget: number; // inline deadline — default 3000ms
  readonly markdownCap: number; // bytes handed to the LLM — default 40_000
  readonly llm: { readonly apiKey: string; readonly model: string };
}
```

Tests: `Extractor` unit tests with `overrideProvider` fakes for `PAGE_FETCHER`/`LLM`
(ADR-0016's DI-instead-of-ports argument, applied), plus a real-db integration spec
covering reuse, negative caching, permanent-failure reuse, provisional→resolved
promotion, and in-flight dedup.

## Phase 10 — Module wiring + barrel

`ExtractionModule` via `ConfigurableModuleBuilder`, mirroring `DatabaseModule`.
Imports `DatabaseModule`. Provides `Extractor`, `PAGE_FETCHER` → `HttpPageFetcher`,
`LLM` → `VercelAiLlm`. Exports `Extractor` only — the ports are internal, overridable
in tests by token.

`src/index.ts` exports `Extractor`, `ExtractionModule`, `ExtractionModuleOptions`,
`ExtractionFailure`, and the two port interfaces + tokens (so a future app can supply
its own implementation). Not the parsers, not the mapper.

## Decision records (already written)

Written ahead of the code, since they have no dependency on it:

| #    | Title                                                                            | Governs phase |
| ---- | -------------------------------------------------------------------------------- | ------------- |
| 0020 | `ServiceFailure` as an extensible service-layer failure vocabulary               | 0, 1          |
| 0021 | Repository capabilities via interfaces and composition, not inheritance          | 2             |
| 0022 | `Vendor` provisional and resolved states                                         | 3             |
| 0023 | Extraction as an append-only audited record, and failed extraction as an outcome | 4, 5, 9       |
| 0024 | Ports for `PageFetcher` and `Llm`, and the scope of ADR-0016                     | 6, 8          |
| 0025 | Extraction owns the Vendor lifecycle; services never import services             | 6, 9          |

**ADR-0004** amended: controllers moved to `apps/api`; the cross-feature rule replaced
with "services never import services" plus a write-ownership convention; `vendor`
dropped from the slice list; `libs/extraction` added as a horizontal lib; the dependency
diagram and the domain-types-as-lingua-franca rule updated.

**ADR-0001** amended: structured-data-first (JSON-LD, OpenGraph) precedes the LLM path —
still generic extraction, not the per-vendor parsers it rejected, but the original text
read as "LLM always" and no longer describes the system.

**`CONTEXT.md`** updated: `Extraction` and `Extraction Key` added; `Vendor` amended for
provisional/resolved; `Item` notes that two Users saving one URL get two independent
Items; `Price History` and `Extraction Status` cross-reference `Extraction` so the three
don't get conflated later.

No documentation work remains in this plan. If implementation contradicts a decision
above, amend the ADR in the same commit rather than letting the two drift.

---

## Sequencing

Phases 0, 1, and 2 are prerequisites and independent of each other — parallelizable.
Phase 3 depends on 2. Phases 4–5 depend on 3. Phases 6–10 are the lib itself and run in
order. ADRs and `CONTEXT.md` are already written.

Suggested commit boundaries: one per phase, with 4+5 together (the domain entity and
its persistence are meaningless apart) and 7+8 together (both are "produce a lenient
shape from HTML", and 7 alone has no caller).

## Known risks

- **Phase 2 touches all 10 repositories at once.** No behavioural change intended, and
  the existing real-db repository specs are the safety net. Land it alone, not folded
  into another phase.
- **Phase 3 changes a shipped entity and its table.** `Vendor` currently round-trips
  through the generic mapper; after this it needs a bespoke one and a migration. Any
  code assuming `vendor.name` is always present breaks at compile time, which is the
  desired failure mode.
- **`ExtractionKey`'s tracking-parameter denylist is a guess.** It cannot be validated
  without real URLs. Under-stripping costs reuse rate; over-stripping serves the wrong
  product's price. Start conservative, widen from observed data, and treat the
  normalization table test as the place that records what was learned.
- **The 3s inline budget is unvalidated.** It was chosen to make the structured-data
  path comfortable and the LLM path marginal. If the LLM path routinely times out, the
  fix is to raise the budget or accept that non-structured retailers always go through
  the queue — both are configuration, not redesign.
- **`HttpPageFetcher` will be blocked by major retailers.** Expected, not a defect;
  ADR-0024 exists so the reader-API swap needs no caller changes. Do not spend effort on
  stealth headers in this plan.

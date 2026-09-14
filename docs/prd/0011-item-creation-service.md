## Problem Statement

`Item` (PRD-0005), the database layer (PRD-0010: `ItemRepository`, `WishlistRepository`,
`VendorRepository`, `CategoryRepository`), and the extraction pipeline (`Extractor`,
`VendorResolver`, ADR-0023–0026) all exist and are independently tested, but nothing
composes them into the actual "paste a URL, get an Item" flow `CONTEXT.md` describes.
ADR-0004 reserves `libs/item/service` for exactly this feature slice; it hasn't been
scaffolded yet, and it would be the first `service` lib in the workspace — the first
thing to exercise the `apps/api → service → domain/database/extraction` dependency
direction ADR-0004 lays out.

## Solution

Add `libs/item/service`, a single `ItemService` with one public method, `create`. Given
a User, a Wishlist, a Category, and a raw URL string, it: validates the URL once
(`Url.create`); confirms the Wishlist and Category both belong to the calling User
(`ServiceFailure.notFound`/`forbidden` otherwise, checked directly against
`WishlistRepository`/`CategoryRepository` — no other feature's `service` lib exists yet
to go through, and ADR-0004 forbids service-to-service imports regardless); runs
`Extractor.extract(url)` synchronously, bounded by `libs/extraction`'s own budget
(`ExtractionModuleOptions.budget`, default 3s) — no queue or background worker exists in
the workspace yet, and none is introduced by this PRD; then reconciles `Item`'s domain
state with the `Extraction`'s business outcome in a single write.

The resulting `Extraction` already carries a resolved `vendor: Id` (`VendorResolver`
runs inside `Extractor`, ADR-0025) — this service never touches Vendor lookup/creation
itself, only reads `extraction.vendor` off the result, so `Item.create` can only be
called *after* extraction returns, not before. A `PendingItem` is constructed in memory
only — never inserted on its own — and immediately transitioned: `Item.extract` for a
`'succeeded'` Extraction, `Item.failed` for a `'failed'` one, before the single
`ItemRepository.insert`. A `'failed'` Extraction is a normal business outcome (the page
was blocked, the LLM couldn't read it, whatever), not a service-level error — the
resulting `Item` still gets created and persisted, just as a `FailedExtractionItem`, so
the User can correct it manually later (PRD-0005's `Item.correct`). The same treatment
applies one level deeper: `Item.extract` itself can reject a `'succeeded'` Extraction's
data (empty `name`), and that `Err` is downgraded to `Item.failed(pending,
'invalid-data')` rather than aborting — extraction-side problems, however they surface,
never block Item creation. Only an `Err` from `Extractor.extract` itself (a genuine
infrastructure/persistence failure) becomes a `ServiceFailure`, and in that case no Item
is created at all.

## User Stories

### Input & authorization

1. As a developer, I want `ItemService.create(input: { user: Id; wishlist: Id; category:
   Id; url: string }): AsyncResult<Item, ServiceFailure>` as the lib's one public
   method.
2. As a developer, I want `input.url` validated exactly once via `Url.create`, checked
   first — before any repository call, since it's free and needs no DB. `Url.create`
   returns `Result<Url, DomainFailure>` (tag `'validation'` on bad input); its `Err` is
   wrapped via `ServiceFailure.invalid(domainFailure)`, no repository or `Extractor` call
   made, no Item created. On success, the resulting `Url` is reused for both the
   `Extractor.extract` call and the later `Item.create` call — never re-validated. (Note:
   PRD-0005's prose lags the shipped
   `libs/domain` code in several places — `Item.create` story text says the URL is
   "validated inside `Item.create`" while the shipped signature takes `url: Url`
   already-branded; PRD-0005 also names the failure/retry transitions `failExtraction`,
   `correctManually`, `retryExtraction` while the shipped namespace exports them as
   `Item.failed`, `Item.correct`, `Item.retry`. This PRD follows the shipped code
   throughout, not the PRD-0005 prose — `ItemService` is the one call site that turns the
   raw string into a `Url`.)
3. As a developer, I want the Wishlist looked up by `input.wishlist` via
   `WishlistRepository.find`, whose `Err` is a `DatabaseFailure` — not automatically a
   "missing" signal. Only `error.name === 'not-found'` becomes
   `ServiceFailure.notFound(`wishlist:${input.wishlist}`)`; any other `DatabaseFailure`
   variant (`constraint`/`query`/`mapping`) becomes `ServiceFailure.unexpected`, per the
   same `match(error.name)` pattern `Extractor.lookup` already uses for its own
   repository. Found but `.user !== input.user` →
   `ServiceFailure.forbidden(input.user, `wishlist:${input.wishlist}`)`. This is checked
   first, before the Category check — its `.andThen()` chain short-circuits, so a bad
   Wishlist id means `CategoryRepository` is never even called.
4. As a developer, I want the same check (same `not-found`-vs-other-`DatabaseFailure`
   branching, same `category:${input.category}` resource-string convention) against
   `CategoryRepository` for `input.category`, run only after the Wishlist check passes —
   Category is user-scoped per `CONTEXT.md`, so a foreign Category id is rejected the same
   way a foreign Wishlist id is.
5. As a developer, I want no Vendor handling anywhere in this lib — lookup, creation, and
   resolution stay entirely inside `libs/extraction` (ADR-0025); this service only ever
   reads `extraction.vendor`.
6. As a developer, I want no Unsorted-Category default/provisioning logic here —
   `category` is a required, already-resolved `Id` the caller supplies; provisioning it
   at signup is a future Account-service PRD's problem, not this one's.

### Extraction → Item reconciliation

7. As a developer, I want `Extractor.extract(url)` — not `Extractor.refresh(url)` — called
   after both ownership checks pass. `extract()` deliberately reuses any sufficiently-fresh
   cached `Extraction` (ADR-0023's freshness window), including one produced by a
   different User's earlier `create()` call on the same URL — consistent with
   `CONTEXT.md`'s "Extraction is global... one attempt serves whoever asks next." Forcing
   a fresh scrape on every Item creation is `refresh()`'s job, reserved for the (out of
   scope) explicit retry flow (`Item.retry`), not `create()`'s.
8. As a developer, I want an `Err` from `Extractor.extract` (its own `ExtractionFailure`
   — `persist-failed`, `misconfigured`, etc.) wrapped into `ServiceFailure.unexpected`;
   no Item is created in this path.
9. As a developer, I want an `Ok` Extraction with `_tag: 'succeeded'` to produce
   `Item.create({ wishlist, vendor: extraction.vendor, category, url })` followed by
   `Item.extract(pending, extraction.data)` — `extraction.data` is already shaped as
   `Item.ExtractionData` (PRD-0005/ADR-0023), so no field mapping is needed.
   `Item.extract` itself returns `Result<ExtractedItem, DomainFailure>` (it schema-checks
   `data.name` as non-empty) — an `Err` here is *not* surfaced as a `ServiceFailure`.
   Instead it's downgraded the same way a `'failed'` Extraction is: call
   `Item.failed(pending, 'invalid-data')` and persist that instead, so the User still gets
   an Item to correct manually rather than the whole `create()` call aborting. This keeps
   faith with the PRD's broader stance (§Solution) that extraction-side problems never
   block Item creation — even one only discovered after `Extraction` itself reported
   `'succeeded'`.
10. As a developer, I want an `Ok` Extraction with `_tag: 'failed'` to produce the same
    `Item.create(...)` followed by `Item.failed(pending, extraction.reason)`,
    storing the `ExtractionReason` code (e.g. `'blocked'`, `'llm-failed'`) as-is as the
    `FailedExtractionItem`'s `reason` string — no rephrasing into a longer sentence in
    this PRD; a friendlier per-code message is a UI-layer concern if ever needed.
11. As a developer, I want exactly one `ItemRepository.insert` call per `create()`
    invocation, on the final (`Extracted` or `Failed`) state — never a separate insert
    for the in-memory `PendingItem`.
12. As a developer, I want the reconciliation written as `ts-pattern`'s
    `match(extraction).with({ _tag: 'succeeded' }, ...).with({ _tag: 'failed' },
    ...).exhaustive()` per CLAUDE.md's no-`switch`-on-discriminated-unions rule.

### Failure vocabulary

13. As a developer, I want `ItemService.create` to return the bare `ServiceFailure`
    (`@wish-list/common-error/service`, ADR-0020) with no generic-parameter extension —
    `notFound`, `forbidden`, `invalid`, and `unexpected` cover every case this method
    produces. No dedicated `item-failure.ts` file is needed (contrast `ExtractionFailure`,
    which does add its own names) since there's nothing feature-specific to add yet.

## Implementation Decisions

- **File:** `libs/item/service/src/lib/item.service.ts` — one `@Injectable()
  ItemService` class; ownership checks and the extraction-reconciliation step are
  `private` methods on it, not top-level helpers (CLAUDE.md).
- **Nx project:** `libs/item/service`, package `@wish-list/item-service`, nx name
  `item-service`, tags `scope:item`, `type:service` (ADR-0004's tagging convention).
- **No `libs/item/data` yet:** nothing consumes a DTO across the API seam until
  `apps/api` exists — ADR-0004's "small features may not need all three [libs]" applies.
- **Dependencies:** `@wish-list/domain`, `@wish-list/database`, `@wish-list/extraction`,
  `@wish-list/common-result`, `@wish-list/common-error/service`. Nothing else in `libs/`
  — no other feature's `service` lib exists to import even if the rule allowed it.
- **Constructor injection** of `WishlistRepository`, `CategoryRepository`,
  `ItemRepository`, `Extractor` — all already `@Injectable()` Nest providers from their
  respective modules (`DatabaseModule`, `ExtractionModule`).
- **`create()`'s body is one `Result.safeTry(this, async function* () {...})` generator**
  (`@wish-list/common-result`'s do-notation), `yield*`-ing each fallible step in order —
  Url validation, Wishlist check, Category check, `Extractor.extract`, reconciliation —
  per ADR-0027. Ownership checks return `AsyncResult<void, ServiceFailure>` (or the fetched
  entity, if a later story ends up needing it) so they can be `yield*`-ed directly.

## Testing Decisions

- Vitest, mocking `WishlistRepository`, `CategoryRepository`, `ItemRepository`, and
  `Extractor` (no real DB/HTTP/LLM calls), following the existing extraction-lib spec
  precedent.
- Malformed `input.url` → `ServiceFailure.invalid`, checked before any repository call —
  assert `WishlistRepository.find`/`CategoryRepository.find`/`Extractor.extract`/
  `ItemRepository.insert` are all never called.
- Missing Wishlist / Wishlist owned by a different User → `ServiceFailure.notFound` /
  `forbidden`, `ItemRepository.insert` never called.
- Missing Category / Category owned by a different User → same, but only reachable when
  the Wishlist check passes — a bad Wishlist id short-circuits before `CategoryRepository`
  is ever called, so this case's test must stub a valid Wishlist first.
- `ServiceFailure.notFound`/`forbidden` for each check carry a distinguishing resource
  string (`wishlist:<id>` / `category:<id>`) — assert on it so a Wishlist failure and a
  Category failure aren't silently interchangeable in test output.
- `WishlistRepository.find`/`CategoryRepository.find` returning a non-`not-found`
  `DatabaseFailure` (e.g. `query`) → `ServiceFailure.unexpected`, not `notFound` — guards
  against collapsing a real infra failure into a false "missing" result.
- `Extractor.extract` returning `Err` → `ServiceFailure.unexpected`, `insert` never
  called.
- `Extractor.extract` returning `Ok` succeeded Extraction → `insert` called exactly once
  with an `ExtractedItem` whose `vendor`/`name`/`price`/`image` match the Extraction's
  `vendor`/`data`.
- `Extractor.extract` returning `Ok` succeeded Extraction whose `data.name` is empty →
  `Item.extract`'s `Err` is downgraded, not surfaced: `insert` called exactly once with a
  `FailedExtractionItem` whose `reason` is `'invalid-data'`, `create()` still resolves
  `Ok`, no `ServiceFailure` returned.
- `Extractor.extract` returning `Ok` failed Extraction → `insert` called exactly once
  with a `FailedExtractionItem` whose `reason` matches the Extraction's `reason` code.
- Assert `insert` is called exactly once (not zero, not two) in all three outcome paths
  above — guards against a stray Pending-row insert sneaking back in.

## Out of Scope

- HTTP layer / controller — `apps/api` doesn't exist yet, and ADR-0025 keeps controllers
  out of service libs regardless.
- Vendor lookup/creation — entirely owned by `libs/extraction` (ADR-0025).
- Unsorted-Category provisioning-at-signup — future Account-service PRD.
- Manual correction / retry-extraction / mark-Fulfilled service methods — the domain
  transitions already exist (shipped as `Item.correct`, `Item.retry` — PRD-0005's prose
  calls them `correctManually`/`retryExtraction`, see note below), but wiring them into
  `ItemService` is separate future work, not needed for `create`.
- Async/queued extraction, notifications, webhooks — no queue infra exists in the
  workspace; not introduced here.
- Item listing/query service methods — `ItemRepository.findByWishlist` already exists
  (PRD-0010); exposing it through `ItemService` is a future story.
- Duplicate-URL-within-the-same-Wishlist detection — `CONTEXT.md` only calls out
  cross-User independence; no same-user uniqueness constraint exists on the `items`
  schema (PRD-0010), so none is added here.

## Further Notes

- First `service` lib in the workspace — the shape here (`@Injectable`,
  `AsyncResult<T, ServiceFailure>` return, direct repository injection, no
  cross-service imports) is the template the `wishlist`/`category`/`coupon`/`sharing`/
  `tracking` service libs will likely follow.
- Depends on PRD-0004 (Vendor/Category), PRD-0005 (Item), PRD-0010 (repositories),
  ADR-0004 (service lib placement/dependency direction), ADR-0020 (`ServiceFailure`),
  ADR-0023–0026 (`Extractor`/`VendorResolver`), ADR-0027 (generator do-notation for
  service composition).
- `apps/api` remains unbuilt after this PRD — `ItemService` is callable but not yet
  reachable over HTTP. That gap is the natural next PRD.

# Plan 0016 — Extraction reuse (`extract`, dedup, module surface)

Finishes plan `0012` Phase 9 (second half) and Phase 10, both deferred by plan `0015`.
No new ADR — follows ADR-0023 (append-only, failed extraction is an outcome) and 0012
decisions 14–15 (reuse is a two-method API; failed extractions are reused too, on a
shorter window). If implementation contradicts a decision, amend the ADR in the same
commit.

## Scope

In:

- `Extractor.extract(url)` — reuse a fresh record, or fall through to `refresh`.
- `freshness` / `failureWindow` join `ExtractionModuleOptions`.
- Negative caching: a `failed` record is reused within `failureWindow`;
  `'unsupported-currency'` is reused forever.
- In-flight dedup — concurrent callers for one key share a single `refresh`.
- `ExtractionModule` imports `DatabaseModule`; `exports` narrows to `Extractor`.
- `src/index.ts` surface check (already correct — see Decision 5).

Out: everything plan `0012`/`0015` already placed elsewhere — retry queue, rate
limiting, request idempotency, `apps/api`.

## Decisions

| # | Decision |
|---|----------|
| 1 | **Reuse table exactly per 0012 decision 14/15**, checked in order: `succeeded` && `age < freshness` → return it. `failed` && `reason === 'unsupported-currency'` → return it, unconditionally (permanent). `failed` && `age < failureWindow` → return it (negative cache). Anything else, including no record at all, falls through to `refresh(url)`. |
| 2 | **In-flight dedup lives on `refresh`, not on `extract`.** `refresh` is the thing that hits the network, and plan `0015` named this exact gap in its accepted consequences: "Two concurrent `refresh` calls for one URL both fetch... until then the only ceiling is the caller." Putting the `Map<ExtractionKey, Promise<...>>` on `refresh` closes that gap for direct callers too (tracking's daily fetch, 0012 decision 14) and `extract`'s fall-through inherits it for free — no separate map. |
| 3 | **A lookup failure other than `'not-found'` is `persist-failed`, not a silent fall-through.** `findLatestByKey` can fail with `'query'`/`'mapping'`, mapped by `ExtractionRepository` to a `DatabaseFailure`. Treating that as "no record, go fetch" would mask a real infra problem behind a network call and possibly a wrong-looking success. `'not-found'` is the only lookup outcome that means "nothing to reuse"; every other name becomes `ExtractionFailure.persistFailed` and `extract` returns `Err` without touching the network — consistent with how `VendorResolver.ensure` already treats `DatabaseFailure` by name. |
| 4 | **Written as `Result`/`AsyncResult` combinators, not a `safeTry` generator.** `refresh` (plan `0015`) predates commit `b4dfd98`'s move away from generators; `extract` is new code and follows the current style — `match` on the looked-up `Extraction` (ts-pattern, per `CLAUDE.md`) feeding `.map`/`.andThen`/`.orElse`. `refresh` itself is untouched by this plan beyond gaining the dedup wrapper. |
| 5 | **`src/index.ts` needs no change.** It already exports `PageFetcher`/`PAGE_FETCHER` and `Llm`/`LLM` (0012 Phase 10: "so a future app can supply its own implementation") and does not export `Extractor` yet — this plan adds that one line. The port exports are package-level surface (any consumer can implement a port); the Nest module's `exports` array is DI visibility (what an importing module can `@Inject`) — narrowing the latter from `PAGE_FETCHER` to `Extractor` does not touch the former. |
| 6 | **`freshness`/`failureWindow` have no runtime default.** Matching `budget`/`markdownCap` today: the type declares them required, a doc comment states the recommended value (24h / 5min, per 0012 decision 15), and the caller (later, `apps/api`) supplies them at `ExtractionModule.forRoot(...)`. No default-merging logic belongs in a lib with no owner of "the app's config" yet. |

## Target layout

```
src/lib/
  extractor.ts             + extract(url), in-flight dedup on refresh(url)
  extraction.options.ts    + freshness, failureWindow
  extraction.module.ts     imports DatabaseModule, exports narrow to [Extractor]
  index.ts                 + export { Extractor }
```

## Shapes

```ts
// extraction.options.ts
export interface ExtractionModuleOptions {
  readonly markdownCap: number;
  readonly budget: number;
  /** Reuse a succeeded record younger than this. Recommended default 24h. */
  readonly freshness: number;
  /** Reuse a failed record younger than this. Recommended default 5min. */
  readonly failureWindow: number;
  readonly llm: { readonly apiKey: string; readonly model: string };
}
```

```ts
// extractor.ts
@Injectable()
export class Extractor {
  private readonly inFlight = new Map<
    ExtractionKey,
    Promise<Result<Extraction, ExtractionFailure>>
  >();

  public extract(url: Url): AsyncResult<Extraction, ExtractionFailure>;
  public refresh(url: Url): AsyncResult<Extraction, ExtractionFailure>; // unchanged signature
}
```

```
extract(url):
  key    = ExtractionKey.fromUrl(url)
  latest = extractions.findLatestByKey(key)
  latest.err.name === 'not-found'  → refresh(url)
  latest.err (other)               → Err(persistFailed(...))
  latest.ok:
    match(latest):
      succeeded, age(latest) < freshness                        → Ok(latest)
      failed, reason === 'unsupported-currency'                 → Ok(latest)
      failed, age(latest) < failureWindow                       → Ok(latest)
      otherwise                                                  → refresh(url)
```

```
refresh(url):                          # dedup wraps the existing 0015 body
  key = ExtractionKey.fromUrl(url)
  inFlight.get(key) ?? register-and-run(key, () => <0015's refresh body>)
  # entry deleted from inFlight in a .finally, success or failure, so the
  # next call for that key (once settled) always runs fresh.
```

`age(extraction)` = `Date.now() - extraction.createdAt.getTime()`, a private method,
not exported — nothing outside `Extractor` needs it.

## Module wiring

```ts
@Module({
  imports: [HttpModule, DatabaseModule],
  providers: [/* unchanged */],
  exports: [Extractor],
})
export class ExtractionModule extends ConfigurableModuleClass {}
```

`PAGE_FETCHER` drops out of `exports` — nothing outside this module ever injected it,
and 0012 Phase 10 says the ports are internal, swappable in tests by token, not by
another module's DI graph.

```ts
// index.ts — one addition
export { Extractor } from './lib/extractor.js';
```

## Commits

Each compiles and is green on its own.

1. `feat: reuse a fresh extraction record` — `freshness`/`failureWindow` options,
   `extract(url)`, the lookup-failure branch. Unit spec with a fake `ExtractionRepository`
   (`findLatestByKey` stubbed) and `vi.useFakeTimers()`: fresh succeeded record reused,
   `refresh` never called; stale succeeded record → `refresh` called; `'unsupported-currency'`
   reused regardless of age; fresh failed (other reason) reused; stale failed (other
   reason) → `refresh` called; `'not-found'` → `refresh` called; other `DatabaseFailure`
   name → `Err('persist-failed')`, `refresh` never called.
2. `feat: dedup concurrent refresh calls` — the `inFlight` map on `refresh`. Unit spec:
   two concurrent `refresh(url)` calls for the same key → `reader.read` invoked once,
   both callers resolve to the same `Extraction.id`; after the first settles, a third
   call runs fresh (`reader.read` invoked again); two different URLs never share an
   entry.
3. `feat: wire ExtractionModule into DatabaseModule, narrow its exports` —
   `imports: [DatabaseModule]`, `exports: [Extractor]`, `index.ts` gains `Extractor`.
   No new spec; existing `extractor.spec.ts` and `vendor-resolver.spec.ts` (which
   already wire `VendorRepository`/`ExtractionRepository` directly via
   `databaseTestingProviders`) stay green unchanged — this commit only affects apps that
   import `ExtractionModule`, and none exist yet.

## Tests

- No test calls a real retailer or the real model, same as plan `0015`.
- `age`/window assertions use `vi.useFakeTimers()` and construct fixture `Extraction`
  records with an explicit `createdAt`, not real sleeps.
- Dedup spec asserts call *count* on the fake `PageFetcher`/`Llm`, not timing.

## Accepted consequences

- **`extract`'s reuse windows are process-local wall-clock, not transactional.** Two
  `extract` calls arriving microseconds apart on different server instances can both
  read the same stale record and both call `refresh` — dedup only helps within one
  process's `Map`. Acceptable: the negative-caching goal is capping outbound blast
  radius, not exactness, and a retry queue (still out of scope) is the place a
  cross-process guarantee would belong.
- **A record reused via `extract` is not re-inserted.** "Reuse" returns the existing row
  as-is; append-only stays true because nothing new is written on a cache hit.
- **`inFlight`'s dedup window is exactly the pending promise's lifetime.** A `refresh`
  that takes 2.9s (near `budget`) means every caller in that window shares one row; a
  caller arriving 1ms after settlement pays for a fresh fetch. This is the same
  trade-off 0012 already accepted for the persisted freshness window, one level down.

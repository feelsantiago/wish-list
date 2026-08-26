# Plan 0015 — Extraction pipeline (`refresh`)

Implements the first half of plan `0012` Phase 9: everything that turns a `Url` into a
persisted `Extraction` exactly once. No new ADR — every decision follows ADR-0023
(append-only record, failed extraction is an outcome), ADR-0024 (`PageFetcher`/`Llm` are
ports), ADR-0025 (extraction owns the Vendor lifecycle) and ADR-0026 (one
`ProductReading` per source, gated by all-five completeness). If implementation
contradicts one, amend the ADR in the same commit.

## Scope

In:

- `PageProductReader` — `Url` → fetch → structured → LLM fallback → domain types.
- `VendorResolver` — find-or-provision by registrable domain, and provisional → resolved.
- `Extractor.refresh(url)` — the whole pipeline under one budget, recorded as one
  `Extraction` row, succeeded or failed.
- `budget` joins `ExtractionModuleOptions`, and is actually enforced.

Out, deferred to plan `0016` (0012 Phase 9's second half + Phase 10):

- `Extractor.extract(url)`, `freshness`, `failureWindow`, negative caching.
- In-flight dedup (`Map<ExtractionKey, Promise<…>>`).
- Module `exports` narrowing and the `src/index.ts` surface.

`refresh` is the pipeline; `extract` is a caching policy wrapped around it. Splitting
here means the reuse plan gets written against a working `refresh` rather than against an
idea of one, and `refresh` is independently useful — tracking's daily price fetch calls it
directly (0012 decision 14).

## Decisions

| # | Decision |
|---|----------|
| 1 | **Pipeline failure names already _are_ `ExtractionReason`s.** Each step's `Err` name — `'fetch-failed' \| 'blocked' \| 'timeout'` (`PageFetcher`), `'llm-failed'` (`LlmProductReader`), `'unsupported-currency' \| 'no-data'` (`CompleteProductReading.toDomain`) — is a member of the domain's `ExtractionReason` union, exactly and without remainder. So the pipeline's error type is declared as `Failure<ExtractionReason>` and recording is `reason: failure.name`. No translation table, no `match` that has to be kept in sync; a step that invents a name outside the union stops compiling at the point it is composed. |
| 2 | **`PageProductReader` is its own class, not methods on `Extractor`.** It reads a product from a page (fetch → parse → LLM → domain); `Extractor` owns the Vendor lifecycle, the budget and the record. Different collaborators, different test setups, and it names the seam a second `PageFetcher` implementation is swapped behind. The name mirrors `LlmProductReader`: source-prefixed reader, same `ProductReading` vocabulary. |
| 3 | **No cross-source merging.** JSON-LD's `name`+`image` are not combined with OpenGraph's `price`. ADR-0026's gate is per source and `SucceededExtraction.source` is a single value — a merged reading would make that field a lie and would mix two trust levels in one record. If observed data shows merging is worth it, it earns a `'merged'` source and its own decision. |
| 4 | **`VendorResolver` owns find-or-provision.** `VendorRepository.findByVendorDomain` returns `Err('not-found')`, which is a lookup answer here, not a failure: the resolver translates it into an insert of `Vendor.provisional`. It also handles the unique-index race (two concurrent first-sightings of one domain) by re-finding once on `'constraint'`. Every other `DatabaseFailure` becomes `ExtractionFailure.persistFailed`. |
| 5 | **One budget knob, enforced in three places.** `Extractor` races the whole pipeline against `budget` and records `'timeout'` when the race is lost; `HttpPageFetcher` takes its request timeout from `budget` instead of its private `TIMEOUT_MS`; `VercelAiLlm` passes `AbortSignal.timeout(budget)` to `generateObject`. The race alone bounds the _answer_ but not the _spend_ — an abandoned `generateObject` keeps streaming and keeps billing — so the adapters self-bound too. Port signatures are unchanged: no `signal` parameter is threaded through `PageFetcher`/`Llm`, because the deadline is module configuration that every adapter can read for itself (ADR-0024's ports stay swappable without inheriting a cancellation contract). |
| 6 | **Every `ExtractionReason` returns `Ok(FailedExtraction)`.** `Err` stays reserved for `'persist-failed'` and `'misconfigured'` — infrastructure breakage, per ADR-0023 and 0012 decision 12. A blocked retailer is a recorded outcome and the caller still gets the Vendor `Id` the record carries. |
| 7 | **The Vendor row is written before the extraction row.** `extractions.vendor` is an FK, and a `succeeded` row pointing at a still-provisional Vendor would contradict itself. Order: ensure Vendor → read page → (on success) resolve + update Vendor → insert `Extraction`. |
| 8 | **`Extractor` is registered as a provider now, exported nowhere.** Its spec needs a Nest context; the public surface is plan `0016`'s to narrow. `src/index.ts` is untouched by this plan. |

## Target layout

```
src/lib/
  reading/
    extracted-product.ts        ExtractedProduct + ReadingFailure
    page-product-reader.ts      Url → ExtractedProduct
  vendor/
    vendor-resolver.ts          ensure / resolve
  extractor.ts                  refresh(url)
  extraction.options.ts         + budget
  fetcher/http.page-fetcher.ts  timeout from options
  llm/vercel-ai.llm.ts          + abortSignal
```

## Shapes

```ts
// reading/extracted-product.ts
export interface ExtractedProduct {
  readonly source: ExtractionSource;
  readonly item: Item.ExtractionData;
  readonly vendor: Vendor.ExtractionData;
}

/**
 * Every reason the page itself can fail for. Assignable from each step's own
 * narrower failure type, so `reason: failure.name` needs no mapping.
 */
export type ReadingFailure = Failure<ExtractionReason>;
```

```ts
// reading/page-product-reader.ts
@Injectable()
export class PageProductReader {
  public constructor(
    @Inject(PAGE_FETCHER) fetcher: PageFetcher,
    parsers: StructuredParsers,
    llm: LlmProductReader,
  );

  public read(url: Url): AsyncResult<ExtractedProduct, ReadingFailure>;
}
```

```
read(url):
  html = yield* fetcher.fetch(url)              → 'fetch-failed' | 'blocked' | 'timeout'
  doc  = HtmlDocument.parse(html)
  first candidate of parsers.parse(doc) whose reading completes
    → toDomain(complete, url)                   → 'unsupported-currency' | 'no-data'
  none complete:
    reading = yield* llm.read(doc)              → 'llm-failed'
    complete(reading) or Err('no-data')
    → toDomain(complete, url)
```

The generator from `StructuredParsers.parse` stays lazy (ADR-0026): OpenGraph is never
parsed when JSON-LD already completed, and `MarkdownPage`/the LLM are never reached when
either did.

```ts
// vendor/vendor-resolver.ts
@Injectable()
export class VendorResolver {
  public constructor(vendors: VendorRepository);

  /** Existing Vendor for the URL's registrable domain, or a freshly inserted provisional one. */
  public ensure(url: Url): AsyncResult<Vendor, ExtractionFailure>;

  /** Promotes to resolved and persists. A resolved Vendor is re-resolved — the snapshot is the point. */
  public resolve(
    vendor: Vendor,
    data: Vendor.ExtractionData,
  ): AsyncResult<ResolvedVendor, ExtractionFailure>;
}
```

`ensure` maps `DatabaseFailure` by name: `'not-found'` → insert provisional;
`'constraint'` on that insert → re-find once (lost the race, someone else inserted it);
anything else → `ExtractionFailure.persistFailed`. `VendorDomain.fromUrl`'s
`DomainFailure` → `persistFailed` as well — a URL that yields no registrable domain is a
`Url` that should never have validated, not a page-level outcome.

```ts
// extractor.ts
@Injectable()
export class Extractor {
  public refresh(url: Url): AsyncResult<Extraction, ExtractionFailure>;
}
```

```
refresh(url):
  vendor  = yield* vendorResolver.ensure(url)
  product = race(reader.read(url), budget)      loser → Failure<'timeout'>
  succeeded:
    resolved = yield* vendorResolver.resolve(vendor, product.vendor)
    insert Extraction.succeeded({ url, vendor: resolved.id, source, data, vendorData })
  failed:
    vendor stays provisional
    insert Extraction.failed({ url, vendor: vendor.id, reason: failure.name })
  insert fails → Err(ExtractionFailure.persistFailed(...))
```

## Module options

```ts
export interface ExtractionModuleOptions {
  readonly markdownCap: number;
  /** Whole-pipeline deadline, and the self-bound each adapter reads. Default 3000ms. */
  readonly budget: number;
  readonly llm: { readonly apiKey: string; readonly model: string };
  // Plan 0016 adds: freshness, failureWindow
}
```

`HttpPageFetcher` gains `@Inject(MODULE_OPTIONS_TOKEN)` and drops `TIMEOUT_MS`.

## Commits

Each compiles and is green on its own.

1. `feat: read a product from a page` — `ExtractedProduct`, `ReadingFailure`,
   `PageProductReader`, wired as a provider. Spec against a fake `PageFetcher` and a fake
   `Llm`: JSON-LD complete → LLM never called; JSON-LD incomplete and OpenGraph complete →
   OpenGraph wins with `source: 'opengraph'`; nothing structured → LLM path, `source:
   'llm'`; LLM reply missing a field → `Err('no-data')`; fetcher `Err` propagates by name;
   a GBP page → `Err('unsupported-currency')`.
2. `feat: bound fetch and the LLM by the module budget` — `budget` option, fetcher timeout
   from options, `abortSignal` in `VercelAiLlm`. Specs assert the values reach axios and
   `generateObject`.
3. `feat: add VendorResolver` — `ensure`/`resolve`, constraint re-find. Real-db spec:
   first sighting inserts provisional; second finds the same row; `resolve` promotes and
   persists `name`/`currency`; a resolved Vendor re-resolved keeps one row.
4. `feat: add Extractor.refresh` — orchestration, the budget race, recording. Unit spec
   with `overrideProvider` fakes for `PAGE_FETCHER`/`LLM` plus a real-db integration spec:
   a succeeded refresh writes one `succeeded` row and a resolved Vendor; a blocked page
   writes one `failed` row with `reason: 'blocked'` and leaves the Vendor provisional; two
   refreshes of one URL write two rows (append-only); a reader that outruns `budget`
   records `'timeout'`; a repository insert failure surfaces as `Err('persist-failed')`.

## Tests

- No test calls a real retailer or the real model. The fetcher fake returns committed
  fixtures; the `Llm` fake is `{ generate: vi.fn() }`, as in plan `0014`.
- The budget race is tested with a fake fetcher that resolves after `budget + n` ms and
  `vi.useFakeTimers()` — not with a real sleep.
- The real-db spec follows the existing `*.repository.spec.ts` harness.

## Accepted consequences

- **A slow fetch starves the LLM path.** One budget covering both means a 2.8s fetch
  leaves the model 200ms and the record says `'timeout'`. That is the honest behaviour of
  a single deadline; 0012's known risk already names the fix (raise `budget`, or accept
  that non-structured retailers go through the queue) as configuration, not redesign.
- **A `'blocked'` record is written and nothing retries it.** The retry queue is out of
  scope for 0012 entirely; the row carries `key`, `reason` and `createdAt` for it.
- **A Vendor whose pages only ever fail stays provisional forever**, and so cannot carry a
  Coupon or CouponRule (ADR-0022). Intended.
- **`MarkdownPage.truncated()` is still unrecorded** — carried over from plan `0014`.
  Nothing in this plan persists it either; it would need a column.
- **Two concurrent `refresh` calls for one URL both fetch.** In-flight dedup is plan
  `0016`; until then the only ceiling on outbound requests is the caller.

# Plan 0013 — Structured parsers to project standards

Refactor `libs/extraction/src/lib/structured/` from top-level functions returning
optional-field records into composed classes over `Option`-typed readings. Recorded as
ADR-0026; supersedes plan `0012` item 16 on the "parsers stay pure functions" point only.

Current state: `structured/` is untracked — nothing here has shipped, so the target shape
lands directly as `feat:` commits rather than a `refactor:` series on top of a rejected
design.

## What's wrong today

- `extractJsonLd` / `extractOpenGraph` are free functions; ordering between them would
  become an `if`/`else` ladder inside `Extractor`, and each new source edits it.
- `StructuredData` has five optional fields — bare `undefined`, against the repo rule.
- `parseJsonLd` swallows malformed JSON in a `try`/`catch`, banned by CLAUDE.md, and makes
  "one broken `ld+json` block among three" indistinguishable from "no blocks".
- Both parsers call `load(html)` separately → two cheerio parses per page inside a 3s
  budget, with a third coming for Phase 8's markdown pruner.
- Eight top-level helpers exist to tame JSON-LD's union-typed fields — hand-rolled type
  guards where the repo already uses zod for exactly this (`Item.extract`, `Money.$`).
- The result carries no `ExtractionSource`, which `SucceededExtraction` persists.
- `products[0]` wins — document order, so a "customers also bought" carousel entry can
  beat the main product.

## Decisions

| # | Decision |
|---|---|
| 1 | Strategy + composition. Classes implementing `StructuredParser`, held by a concrete `StructuredParsers`. **No DI token, no port** — ADR-0024 stands. |
| 2 | `StructuredParsers.parse()` yields `Iterable<StructuredCandidate>` **lazily, in order**. The orchestrator judges completeness; the collection never short-circuits on its own. |
| 3 | Candidate carries provenance: `{ source: ExtractionSource; reading: ProductReading }`. |
| 4 | Data shapes stay `interface` + `namespace` (ADR-0007). Classes are for collaborators only. |
| 5 | `HtmlDocument` wraps cheerio; the **orchestrator** parses once and passes it down. Plain constructor, no `Result` — cheerio's `load` is forgiving. |
| 6 | JSON-LD union sloppiness normalized by a **lenient zod schema**, not type guards. Each field ends `.optional().transform(Option.from)` — no `undefined` exists even internally. |
| 7 | Parsers return `Option`, never `Result`. `None` = **source absent** (no `Product` node / no `og:*` tags). A partial reading is `Some`. Malformed JSON → `Option.fromThrowable`, that block skipped, siblings still parsed. |
| 8 | `ProductReading` is **shared with the LLM path**. Completeness and domain conversion exist exactly once for all three sources. |
| 9 | **All five fields required** for completeness. A four-field reading falls through to the next source. |
| 10 | Most-complete `Product` node wins, first-in-order breaking ties (not `products[0]`). |
| 11 | `toDomain` lives in the lib, resolves relative image URLs against the page URL as a private step, and fails as `'unsupported-currency' \| 'no-data'`. |
| 12 | Nothing new is exported from `src/index.ts`. |

## Target layout

```
src/lib/
  html/html-document.ts
  reading/product-reading.ts              ProductReading, CompleteProductReading, toDomain
  structured/
    structured-parser.ts                  interface + StructuredCandidate
    structured-parsers.ts                 the ordered collection
    json-ld.structured-parser.ts
    opengraph.structured-parser.ts
    __fixtures__/                         7 existing + 1 new carousel fixture
  fetcher/  llm/                          untouched
```

Deleted: `structured/json-ld.ts`, `structured/opengraph.ts`, `structured/structured-data.ts`.
Filenames follow the existing `<impl>.<port>.ts` convention (`http.page-fetcher.ts`).

## Shapes

```ts
// html/html-document.ts
export class HtmlDocument {
  public static parse(html: string): HtmlDocument;   // one cheerio load
  public meta(name: string): Option<string>;         // property= then name=, '' → None
  public scripts(type: string): readonly string[];   // ld+json bodies
}

// reading/product-reading.ts
export interface ProductReading {
  readonly name: Option<string>;
  readonly price: Option<number>;
  readonly currency: Option<string>;
  readonly image: Option<string>;
  readonly vendorName: Option<string>;
}

export interface CompleteProductReading {           // no Options past this gate
  readonly name: string;
  readonly price: number;
  readonly currency: string;
  readonly image: string;
  readonly vendorName: string;
}

export namespace ProductReading {
  export const EMPTY: ProductReading;
  export function complete(reading: ProductReading): Option<CompleteProductReading>;
}

export namespace CompleteProductReading {
  export function toDomain(
    reading: CompleteProductReading,
    url: Url,
  ): Result<
    { item: Item.ExtractionData; vendor: Vendor.ExtractionData },
    Failure<'unsupported-currency' | 'no-data'>
  >;
}

// structured/structured-parser.ts
export interface StructuredParser {
  readonly source: ExtractionSource;
  parse(doc: HtmlDocument): Option<ProductReading>;
}

export interface StructuredCandidate {
  readonly source: ExtractionSource;
  readonly reading: ProductReading;
}

// structured/structured-parsers.ts
export class StructuredParsers {
  public constructor(parsers: readonly StructuredParser[]);
  public *parse(doc: HtmlDocument): Generator<StructuredCandidate>;   // lazy, in order
}
```

Wiring — order is policy, so it lives in the module:

```ts
{ provide: StructuredParsers,
  useFactory: () => new StructuredParsers([
    new JsonLdStructuredParser(),
    new OpenGraphStructuredParser(),
  ]) }
```

Orchestrator shape (Phase 9, not this plan):

```
doc = HtmlDocument.parse(html)
for (candidate of parsers.parse(doc))
  complete = ProductReading.complete(candidate.reading)
  if Some → toDomain(complete, url) → succeeded with candidate.source
→ else markdown + Llm → same ProductReading, source 'llm'
→ else failed with 'no-data'
```

## Commits

Each compiles and is green on its own.

1. `feat: add HtmlDocument wrapper over cheerio` — + spec (`property=` → `name=` fallback, `''` → `None`, ld+json bodies).
2. `feat: add ProductReading with completeness gate` — + spec (all-five, each single-missing-field case).
3. `feat: add domain conversion for complete readings` — `toDomain`, relative-image resolution, `Money`/`Currency`/`Url`; + spec (EUR → `'unsupported-currency'`, relative image resolved, negative price → `'no-data'`).
4. `feat: add JSON-LD structured parser` — zod schema, most-complete node selection, `flattenNodes` as the one private recursive method; adapts the existing fixture spec; deletes `json-ld.ts`. Adds the carousel fixture.
5. `feat: add OpenGraph structured parser` — deletes `opengraph.ts` and `structured-data.ts`.
6. `feat: compose structured parsers in order` — `StructuredParsers` + spec pinning laziness with a spy.
7. `chore: wire structured parsers in ExtractionModule`.

## Tests

- All 7 existing fixtures kept, assertions adapted: whole-object `toEqual` with
  `Option.some(…)` / `Option.none()` in place of `undefined`.
- New carousel fixture: main product (name + price + currency + image + brand) placed
  **after** a two-field carousel entry in document order; asserts the main product wins.
- `StructuredParsers` spec uses a stub parser (`{ source: 'opengraph', parse: vi.fn() }`)
  and asserts `not.toHaveBeenCalled()` when JSON-LD already completed — laziness is
  behaviour, not an optimisation.
- Malformed-JSON fixture asserts sibling blocks still parse (today it asserts only that
  nothing throws).

## Accepted consequences

- **OpenGraph will rarely complete.** `product:price:amount` is uncommon, so OpenGraph
  mainly serves pages with product meta but no JSON-LD. Deliberate: a four-field reading
  produces a half-populated Item, worse than an LLM-read one and indistinguishable from a
  good extraction once stored.
- **EUR/GBP pages end at `'unsupported-currency'` after a successful parse.** Correct
  behaviour under ADR-0002 (no conversion), not a parser fault — don't read it as a
  structured-path regression in metrics.
- **A complete carousel entry beats an incomplete main product.** Accepted for now; the
  upgrade is cross-checking `Product.name` against `og:title`/`<title>`, a change inside
  `JsonLdStructuredParser` with no interface impact.
- **No cross-source merging.** A merged reading has no single `ExtractionSource` to
  persist, and mixing a stale `og:price` into fresh JSON-LD is a silent wrong-price bug.
  Revisit only with per-field provenance.

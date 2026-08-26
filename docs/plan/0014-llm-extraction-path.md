# Plan 0014 — LLM extraction path

Implements plan `0012` Phase 8 as reshaped by plan `0013`/ADR-0026. No new ADR: every
decision here follows ADR-0024 (`Llm` is a port) and ADR-0026 (every source produces the
same `ProductReading`, gated by all-five completeness). If implementation contradicts
either, amend the ADR in the same commit.

## What 0013 changed under Phase 8

Plan `0012` Phase 8 assumed a flat `extraction$` object and a domain conversion written
alongside it. Neither holds any more:

- Domain conversion already exists — `CompleteProductReading.toDomain`, shared by all
  three sources. Phase 8 must **not** add a second one.
- `HtmlDocument` owns the single cheerio load (ADR-0026). The markdown pruner reuses it
  instead of calling `load()` a third time.
- The LLM must emit a `ProductReading` (five `Option` fields), not a flat record, so the
  completeness gate and `toDomain` apply to it unchanged.

## Decisions

| # | Decision |
|---|----------|
| 1 | **`Llm` stays a generic port** — `generate<T>(schema, prompt)`, unchanged. A new lib-internal `LlmProductReader` owns the prompt, the lenient schema, and the mapping to `ProductReading`. `VercelAiLlm` is a thin `generateObject` adapter, so a second adapter re-implements nothing and the prompt is testable against a fake `Llm`. |
| 2 | **Pruning splits from conversion.** `HtmlDocument.pruned(): string` clones the DOM, drops noise nodes, serializes. `MarkdownPage` owns `node-html-markdown` and the byte cap. Cheerio stays behind `HtmlDocument`; the shared document is never mutated. |
| 3 | **`MarkdownPage.from` returns a `MarkdownPage`, not a string.** Same reason `HtmlDocument` exists — the markdown is a thing with properties (its text, whether it was cut), and handing back a bare `string` throws away the fact that it was truncated at the one place that knows. |
| 4 | **`ExtractionModuleOptions` lands now** via `ConfigurableModuleBuilder`, mirroring `DatabaseModule`. Ships `markdownCap` and `llm` only; `freshness`/`failureWindow`/`budget` join in Phase 9 when `Extractor` consumes them. `apiKey` cannot be a file constant, and Phase 10 would rewrite the wiring anyway. |
| 5 | **The reader returns a reading, never an `Option`.** A model reply missing `price` is a `ProductReading` with `price: None` — the orchestrator's completeness gate rejects it exactly as it rejects a four-field OpenGraph reading. `Err` is reserved for the call itself failing. |
| 6 | **The LLM schema is lenient in the same way JSON-LD's is** — every field `.optional().transform(Option.from)`, `price` a `string \| number` union. Same reason as plan `0012` item 17: `Currency.$` in the schema coerces a GBP page into `"USD"`. `'unsupported-currency'` is produced by `toDomain`, not by the schema. |
| 7 | **`LlmProductReader` is not a `StructuredParser`.** It is async, it costs money, and it takes a cap. Making it satisfy the sync `StructuredParser` interface would force `StructuredParsers` async and break the laziness spec ADR-0026 pins. `Extractor` calls it explicitly as the fallback. |
| 8 | **Nothing new is exported from `src/index.ts` except `ExtractionModuleOptions`.** The reader, `MarkdownPage`, the schema, and the prompt stay lib-internal. |

## Target layout

```
src/lib/
  html/html-document.ts             + pruned(): string
  markdown/markdown-page.ts         node-html-markdown + byte cap
  llm/
    llm.ts                          unchanged port
    llm-product.schemas.ts          lenient zod → Option fields
    prompt.ts                       productPrompt(page)
    llm-product-reader.ts           HtmlDocument → ProductReading
    vercel-ai.llm.ts                generateObject adapter
  extraction.module.ts              ConfigurableModuleBuilder + options
```

## Shapes

```ts
// html/html-document.ts — added
public pruned(): string;   // clone, strip script/style/nav/footer/header/aside/
                           // form/svg/iframe/noscript + comments, serialize

// markdown/markdown-page.ts
export class MarkdownPage {
  public static from(doc: HtmlDocument, cap: number): MarkdownPage;
  public text(): string;
  public truncated(): boolean;
}

// llm/llm-product.schemas.ts
export const llmProduct$ = z.object({
  name: z.string().optional().transform(Option.from),
  price: z.union([z.string(), z.number()]).optional().transform(/* → Option<number> */),
  currency: z.string().optional().transform(Option.from),
  image: z.string().optional().transform(Option.from),
  vendorName: z.string().optional().transform(Option.from),
});
export type LlmProduct = z.infer<typeof llmProduct$>;   // structurally a ProductReading

// llm/prompt.ts
export function productPrompt(page: MarkdownPage): string;

// llm/llm-product-reader.ts
@Injectable()
export class LlmProductReader {
  public constructor(
    @Inject(LLM) llm: Llm,
    @Inject(MODULE_OPTIONS_TOKEN) options: ExtractionModuleOptions,
  );
  public read(doc: HtmlDocument): AsyncResult<ProductReading, Failure<'llm-failed'>>;
}

// llm/vercel-ai.llm.ts
@Injectable()
export class VercelAiLlm implements Llm {
  public generate<T>(schema: z.ZodType<T>, prompt: string):
    AsyncResult<T, Failure<'llm-failed'>>;
}
```

`llmProduct$.parse` produces exactly `ProductReading`'s field set, so the reader returns
it directly — no adapter step, and a schema drift breaks the build.

## Module options

```ts
export interface ExtractionModuleOptions {
  readonly markdownCap: number;                                  // bytes, default 40_000
  readonly llm: { readonly apiKey: string; readonly model: string };
  // Phase 9 adds: freshness, failureWindow, budget
}

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<ExtractionModuleOptions>().build();
```

Providers added: `{ provide: LLM, useClass: VercelAiLlm }`, `LlmProductReader`. Exports
stay `PAGE_FETCHER` for now — Phase 10 narrows the surface to `Extractor` once it exists.

`VercelAiLlm` reads both `llm` fields: `createAnthropic({ apiKey })` then
`anthropic(options.llm.model)`. Default model `claude-haiku-4-5` (200K context,
$1/$5 per MTok). A 40KB markdown page is roughly 10–12K input tokens, ~$0.012 per call —
the number that makes structured-data-first (ADR-0001 as amended) worth its complexity.

## Byte cap

`markdownCap` is a **byte** cap, not a character count — it exists to bound spend and
model latency, and tokens track bytes, not JS string length. Truncation cuts on the byte
boundary and drops a trailing partial UTF-8 sequence rather than emitting `U+FFFD`. Cheap
and lossy by design: a page whose product data sits past 40KB of markdown is a page the
pruner failed on, and the fix belongs in `pruned()`. `truncated()` is how Phase 9 can tell
a `no-data` on a cut page from a `no-data` on a whole one.

## Commits

Each compiles and is green on its own.

1. `feat: prune HTML to markdown for the LLM` — `HtmlDocument.pruned()` + `MarkdownPage`
   + specs (noise nodes dropped, `<head>` meta and main content kept, shared document
   unmutated — parse once, prune, then assert `meta()`/`scripts()` still answer, byte-cap
   truncation on a multibyte fixture, `truncated()` both ways).
2. `feat: add lenient LLM product schema and prompt` — `llm-product.schemas.ts` +
   `prompt.ts` + spec (string price parsed, absent fields → `None`, unknown keys ignored,
   `Currency.$` deliberately absent).
3. `feat: configure ExtractionModule with options` — `ConfigurableModuleBuilder`,
   `ExtractionModuleOptions`, export from the barrel. No consumer yet.
4. `feat: add LlmProductReader over the Llm port` — reader + spec against a fake `Llm`
   (prompt carries the markdown, capped; a partial reply yields `Option.none()` fields,
   not an `Err`; an `Err` from the port propagates).
5. `feat: add VercelAiLlm adapter` — `generateObject`, `ExtractionFailure.llmFailed`,
   `'llm-failed'` added to `ExtractionFailureType`, wired as `LLM` in the module.

## Tests

- `MarkdownPage` runs against a new `__fixtures__` page carrying nav/footer/script noise
  around a product block, asserting the noise is gone and the product text survives.
- The reader's spec uses a hand-written fake `Llm` (`{ generate: vi.fn() }`), not
  `overrideProvider` — it has no Nest context of its own until Phase 9's `Extractor` spec.
- No test calls the real API. `VercelAiLlm`'s spec covers failure translation only, with
  `generateObject` mocked; the adapter has no logic beyond that.

## Accepted consequences

- **`pruned()` is a heuristic and will drop useful content on some sites.** Selector-based
  pruning cannot know which `<aside>` holds the price. The failure mode is a `no-data`
  extraction, which is recorded and retryable (ADR-0023), not a wrong price.
- **The prompt is untuned.** It is written once here and validated against fixtures, not
  against live retailers. Real pages will be the first honest signal, and the prompt is a
  one-file change under the port.
- **The 3s deadline is not enforced in this plan.** `HttpPageFetcher`'s `TIMEOUT_MS`
  covers the fetch only; the LLM call is unbounded until Phase 9 puts the pipeline under
  `budget`. Phase 8 must not be treated as latency-complete.
- **Truncation is visible but unrecorded.** `MarkdownPage.truncated()` answers the
  question; nothing persists the answer until something in Phase 9 chooses to.

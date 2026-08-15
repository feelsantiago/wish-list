# Ports for PageFetcher and Llm, and the scope of ADR-0016

`libs/extraction` defines two injection-token ports — `PageFetcher` (URL → HTML) and
`Llm` (zod schema + prompt → validated object) — each with one implementation today
(`HttpPageFetcher` over plain `fetch`; `VercelAiLlm` over the Vercel AI SDK). The
JSON-LD and OpenGraph parsers get no port; they are pure functions with nothing to swap.

This is a deliberate deviation from ADR-0016 ("concrete repositories, no port
abstraction"), and the two are consistent once ADR-0016 is read as scoped to
_repositories_. Its stated rejection was "nothing in this codebase needs a second
implementation of any repository", and its stated trigger for revisiting was "a genuine
need to swap". Both ports here meet that trigger concretely, not speculatively:

- **`PageFetcher`** — plain `fetch` from a datacenter IP will be blocked by major
  retailers. The planned response is a reader/scraping API (Jina Reader, Firecrawl,
  ScrapingBee) behind the same interface. The swap is expected, not hypothetical.
- **`Llm`** — model and provider choice is expected to change (cost, quality, the
  workspace's own preference to stay provider-neutral). ADR-0001 already committed to
  generic extraction with no per-vendor coupling; binding the lib to one vendor's SDK
  would be the same coupling one level up.

Repositories remain concrete. Service libs import `ItemRepository`, not `Readable<Item>`.

## Considered options

- **No ports; call `fetch` and the AI SDK directly.** Fewest layers, consistent with a
  literal reading of ADR-0016. But swapping the fetcher would then mean editing the
  orchestrator, and testing `Extractor` would require intercepting global `fetch` and
  live LLM calls. Rejected.
- **Port only the LLM, not the fetcher.** The LLM is the obvious swap candidate. But the
  fetcher is the component most likely to need replacing _first_ — it is what breaks when
  a retailer deploys bot protection, which is a matter of when, not if. Rejected.
- **Port everything, including the structured-data parsers.** Uniform, but JSON-LD and
  OpenGraph are fixed public specifications; there is no second implementation to swap to,
  and a port there would be abstraction for its own sake, which is what ADR-0016 warns
  against. Rejected.

## Consequences

- Ports and their tokens are exported from `libs/extraction`'s public surface so a future
  app can supply its own implementation. The concrete `HttpPageFetcher`/`VercelAiLlm`
  classes and the parsers are not exported.
- `Extractor` is unit-testable with no network and no API key: `overrideProvider` on
  `PAGE_FETCHER` and `LLM` — the same NestJS-DI-instead-of-hand-written-ports argument
  ADR-0016 makes for repositories, applied to components that also have a real port.
- The zod schema handed to `Llm.generate` is deliberately **lenient**
  (`currency: z.string()`, not `Currency.$`). Constraining the model to the domain enum
  makes it coerce a GBP page into `"USD"` to satisfy the schema, silently storing a
  wrong-currency price. Domain conversion happens after the port returns, turning the same
  page into an explicit `'unsupported-currency'` outcome. The lib's public surface still
  returns domain types (ADR-0004's "layers communicate through domain types"); leniency is
  internal to the port boundary.
- ADR-0016's "delete this ADR's premise" trigger for repositories is unchanged. If a
  service ever needs an in-memory fake repository that Nest DI cannot provide, that is
  still the moment to extract repository interfaces — this ADR does not pre-authorize it.

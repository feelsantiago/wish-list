# Structured parsers as composed strategies over a shared ProductReading

The JSON-LD and OpenGraph readers are classes implementing a common `StructuredParser`
interface, held in order by a concrete `StructuredParsers` collaborator that yields
candidates lazily. Every source — including the LLM — produces the same lenient
`ProductReading`, and a reading is usable only when **all five** of its fields
(`name`, `price`, `currency`, `image`, `vendorName`) are present.

This supersedes plan `0012`'s item 16 on one point only: "the JSON-LD/OpenGraph parsers
stay pure functions". It does **not** reopen ADR-0024 — these are still not ports. There
is no injection token, no `@Inject`, and no second implementation to swap at deploy time.
`StructuredParsers` is a concrete class injected as itself, exactly as ADR-0016 has
repositories injected as themselves. What changed is composition, not indirection:

- **Order is policy, and policy belongs in the module.** "JSON-LD before OpenGraph"
  is a business call about which source to trust; as free functions it was an `if`/`else`
  ladder inside the orchestrator. It is now a factory argument in `ExtractionModule`.
- **Adding a source must not edit the orchestrator.** Microdata or RDFa is a new class
  plus one array entry. `Extractor` has one collaborator and never grows a branch per
  source.
- **Provenance rides with the data.** `SucceededExtraction.source` is persisted, so a
  bare parse result was always losing the fact the orchestrator had to record.
  `StructuredCandidate = { source, reading }` carries it.
- **`Option` all the way in.** ADR-0005 and the repo's no-nullable rule stop at the
  extraction lib's door today: the parsers returned five optional fields and swallowed
  malformed JSON in a `try`/`catch`. Fields are now `Option`, JSON-LD's union-typed
  sloppiness is normalized by a lenient zod schema (as `Item.extract` already does), and
  a miss is `None` — not an error.

## Considered options

- **Keep pure functions, add `Option` only.** Smallest change, and item 16's literal
  reading. But the orchestrator still owns the ordering ladder, and each new source edits
  it. Rejected.
- **A `STRUCTURED_PARSER` multi-token port with DI.** Uniform with `PageFetcher`/`Llm`.
  But ADR-0024 rejected exactly this: JSON-LD and OpenGraph are fixed public
  specifications with nothing to swap to, so a token buys ceremony, not flexibility.
  Rejected.
- **First non-empty candidate wins, inside the collection.** Would let the collection
  short-circuit without asking anyone. But "enough data" is an orchestration judgement:
  a JSON-LD block with only a name would then win outright and suppress an OpenGraph
  block carrying price and image. Rejected — the orchestrator decides completeness.
- **Merge partial candidates across sources** (JSON-LD's name + OpenGraph's price).
  Tempting, and it would raise the LLM-avoidance rate. But a merged reading has no single
  `ExtractionSource` to record, and mixing a stale `og:price` into fresh JSON-LD is a
  silent wrong-price bug — the exact failure this system can least afford. Rejected for
  now; revisit only with per-field provenance.

## Consequences

- **All-five completeness is strict, and OpenGraph will rarely satisfy it.**
  `product:price:amount` is uncommon in the wild, so OpenGraph mostly serves pages that
  ship product meta without JSON-LD. The alternative — accepting a four-field reading and
  filling the gap from elsewhere — produces a half-populated Item, which is worse for the
  user than an LLM-read one and indistinguishable in the data from a good extraction.
- **`ProductReading` is shared with the LLM path**, so completeness and domain conversion
  (`Money.create`, `Currency`, `Url`, `'unsupported-currency'`) exist exactly once for all
  three sources. The LLM's lenient schema from ADR-0024 produces the same shape and is
  tagged `source: 'llm'`.
- **`HtmlDocument` parses the page once.** Both parsers and (later) the markdown pruner
  share one cheerio load inside the 3s budget, and cheerio stops leaking into parser
  signatures.
- **Nothing here is exported.** `ProductReading`, `HtmlDocument`, `StructuredParser`, and
  the parser classes stay lib-internal; the public surface remains the module, the ports,
  and the failure types.
- **Laziness is observable behaviour, not an optimisation.** OpenGraph must not run when
  JSON-LD already completed, and that is pinned by a spy in `StructuredParsers`' spec.

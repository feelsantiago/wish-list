# Discriminated unions for entity state transitions

Where an entity's _shape_ genuinely changes between states — not just a status label — we model it as a discriminated union with a `_tag` field, rather than one interface with optional fields for every state. The first and clearest case is `Item`'s Extraction Status (`CONTEXT.md`): an Item is created from just a URL and exists as `PendingItem` (no name/price/image/currency yet), then becomes either `ExtractedItem` (all fields populated) or `FailedExtractionItem` (fields stay blank, pending manual entry) once scraping resolves.

`_tag` is used as the discriminator (not a domain-meaningful field like `status`) to keep it a technical concern, consistent with `Result`/`Option`'s own `_tag` usage in `libs/common/result` — this avoids collision with `Item`'s own Wanted/Fulfilled `Status` field, which is a genuinely separate, independent concept (`CONTEXT.md` calls this out explicitly: don't confuse Status with Extraction Status). Shared fields across variants live in a base interface (e.g. `BaseItem`) that each variant extends, so common properties aren't duplicated.

Wanted/Fulfilled `Status`, by contrast, has no shape difference between states — every field on `Item` is valid in both. It still narrows via ADR-0012's literal-field mechanism (`WantedItem = Item & { status: 'wanted' }`, no `_tag`) rather than a plain untyped field, so a function like `purchased(item: WantedItem)` is rejected at compile time for a `FulfilledItem` — but it does *not* get its own `_tag` or its own `create`/`from`/`plain`, since ADR-0012's narrowing is a derived view over the same stored shape, not a distinct entity state the way `PendingItem`/`ExtractedItem`/`FailedExtractionItem` are.

## Considered options

- **Single `Item` interface with optional extraction fields** (`name?`, `price?`, ...): one type, simple to start, but allows constructing nonsense states — a "succeeded" extraction with no name, or a "pending" item with a price already set. The type system can't express which fields belong to which state. Rejected.
- **Independent interfaces per state, no shared base**: maximum isolation, but duplicates `id`, `wishlistId`, `url`, `status` (Wanted/Fulfilled), `createdAt` across three interfaces, and changes to shared fields require three edits. Rejected.
- **Discriminated union with base extension (chosen)**: each extraction state is its own type with only the fields valid in that state; the compiler forces exhaustive handling (a `match` on extraction state that forgets `FailedExtractionItem` won't compile) once a new variant is added; the base interface avoids duplicating `id`/`wishlistId`/`url`/`status`/`createdAt`.

## Consequences

- Code that renders or reasons about an Item's extraction state must handle all three variants — enforced by `ts-pattern`'s exhaustiveness checking (see `CLAUDE.md`-style control-flow convention ported alongside this), not just convention.
- `_tag` is preserved through `Plain<Item>` (ADR-0009) so `Item.from(plain)` can dispatch to the correct variant's reconstruction.
- The union type (`Item`) owns cross-variant utilities (`plain`, `isPending`, `isExtracted`, `isFailed`); each variant owns its own `create`/`from` per ADR-0007.
- Re-running extraction after a failure is a state transition (`FailedExtractionItem` → `PendingItem`), not a field mutation — modeled as a function producing a new variant, keeping with the domain layer's plain-data, no-mutation style.
- `Item`'s two axes of variation are independent and compose without a combinatorial explosion of interfaces: `WantedItem`/`FulfilledItem` (ADR-0012, `status`) intersect with the `_tag` union (this ADR) — e.g. `WantedItem = (PendingItem | ExtractedItem | FailedExtractionItem) & { status: 'wanted' }` — TypeScript distributes the intersection over the union automatically, so no `WantedPendingItem`/`WantedExtractedItem`/etc. interfaces need to be hand-written.

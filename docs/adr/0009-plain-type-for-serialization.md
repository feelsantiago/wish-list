# Plain<T> utility type for serialization

We use a recursive conditional type `Plain<T>` (ported into `libs/domain`) to derive a wire-safe, serializable form from any domain entity. It strips branded types to their base (`Id` → `string`, ADR-0006), converts `Option<X>` to `X | null`, converts `Date` to `string`, and recursively processes object fields and arrays. The `_tag` discriminator (ADR-0008) passes through unchanged.

This creates a compile-time contract between `entity.plain()` (produces `Plain<T>`) and `Entity.from()` (consumes it) — see ADR-0007. The round-trip `Item.from(Item.plain(item))` is type-checked: if a field is added to an entity interface but not handled in `plain()`, the compiler catches it. This is also the shape `libs/database` repositories read/write against and the shape API responses in `apps/api` return, so one type definition covers persistence and wire formats both.

## Considered options

- **Manual plain interfaces per entity** (`interface PlainItem { id: string; ... }`): explicit, but duplicates every entity's field list, and drift between entity and plain type is only caught by review. Rejected.
- **Class `.toJSON()`**: requires class-based entities, which ADR-0007 already rejected in favor of plain interfaces + namespaces. Rejected.
- **Serialization library** (class-transformer, superjson): adds a dependency, runtime reflection/decorators, couples serialization to a third-party API. Rejected.
- **Recursive `Plain<T>` type (chosen)**: one generic type definition handles every entity, purely type-level (no runtime cost), and works with `Brand<Base,Tag>` because the brand's structure enables conditional-type extraction of the base.

## Consequences

- Conditional-type ordering inside `Plain<T>` is load-bearing: `Option` must be checked before `object` (its variants are objects), `Date` before `object`, `Brand` before plain primitive passthrough — copy the ordering from the source implementation rather than re-deriving it.
- `Plain<T>` distributes over unions automatically, so `Plain<Item>` correctly produces `Plain<PendingItem> | Plain<ExtractedItem> | Plain<FailedExtractionItem>` (ADR-0008) with no extra work.
- `from()`/`plain()` bodies remain hand-written per entity (ADR-0007), not generated — the compiler enforces completeness via `Plain<T>`'s return/parameter types, but the mapping logic itself is explicit.

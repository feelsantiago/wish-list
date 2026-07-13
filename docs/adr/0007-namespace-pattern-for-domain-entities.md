# Namespace pattern for domain entities

Domain entities in `libs/domain` (`User`, `Wishlist`, `Item`, `Vendor`, `Category`, `Coupon`, `CouponRule`) are modeled as a TypeScript interface paired with a same-name namespace holding static functions: `create`, `from`, and `plain`. Entities are plain data (interfaces), not class instances — the namespace supplies lifecycle operations. This mirrors the pattern already used by `libs/common/result` (`Result.ok()`, `Option.some()`) so the two layers read consistently.

`create(input)` validates untrusted input via `zod` and returns `Result<T, DomainFailure>` (ADR-0010), auto-generating an `Id` (ADR-0006). `from(plain)` reconstructs an entity from trusted data — a `libs/database` repository row — with no re-validation. `plain(entity)` converts to the wire-safe `Plain<T>` form (ADR-0009) for persistence or API responses. Each entity therefore has one clear lifecycle: validate on entry, trust internally, serialize on exit.

## Considered options

- **Classes with methods**: familiar OOP shape, but mixes data with behavior, complicates serialization (`.toJSON()` boilerplate), and fights structural typing — two `Item` instances built differently aren't automatically compatible. Rejected.
- **Standalone factory functions** (`createItem()`, `itemToPlain()`): no namespace overhead, but scatters an entity's operations across differently-named functions with no grouping, harder to discover. Rejected.
- **Interface + namespace (chosen)**: entities stay plain, spreadable, structurally-typed objects. The namespace groups all operations under the entity's name via declaration merging — `const i: Item` and `Item.create(...)` coexist.

## Consequences

- `zod` is a runtime dependency of `libs/domain`, but a `ZodError` never leaks past `create()` — callers see `DomainFailure`, matching ADR-0010.
- `from()` uses `as` casts for branded fields (ADR-0006) — this is the trusted-reconstruction path and is intentional, not a workaround.
- Every entity in `libs/domain` follows the same three-function shape, so the pattern is predictable regardless of which entity you're reading — `Coupon` and `Item` should look structurally the same at the top level.
- Cross-entity references (e.g. `Item.vendorId`, `Item.categoryId`) are stored as the referenced entity's `Id`, not embedded objects — entities compose by reference, not by nesting, keeping `plain()`/`from()` shallow.

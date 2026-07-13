# Branded types for domain values

We use TypeScript branded types (`Brand<Base, Tag>`, ported from a prior project into `libs/domain`) for domain values that share a primitive base type but must never be mixed up: `Id`, `Email`, and `RegistrableDomain` (the value a Vendor is keyed by, per ADR-0002 — a raw string could otherwise be an unvalidated/un-normalized hostname). A branded type is a base type intersected with a phantom compile-time-only tag — zero runtime cost, full type safety.

This matters specifically because wish-list has several distinct entities that resolve to a `string` id (`User`, `Wishlist`, `Item`, `Vendor`, `Category`, `Coupon`) — without branding, a function expecting a Wishlist's id would silently accept an Item's id.

## Considered options

- **Class wrappers** (e.g. `class Email { constructor(readonly value: string) {} }`): real runtime safety, but every comparison, `Map` key, and serialization site must unwrap `.value`. Heavy for values used everywhere like `Id`. Rejected.
- **Raw primitives, validated only at boundaries**: no wrapper overhead, but nothing stops a raw string from being passed as an `Email` deep in the domain layer — bugs from value confusion are silent. Rejected.
- **Branded types (chosen)**: compile-time-only safety, values stay primitives at runtime (`===`, `JSON.stringify`, `Map` keys all work unmodified). Factory functions (`Id.create`, `Email.create`) are the only sanctioned way to mint branded values.

## Consequences

- Branded values require an explicit cast (`as Id`, done inside `from()` only) when reconstructing from a trusted source (a database row) — intentional, since trusted sources skip re-validation. Untrusted input always goes through `create()`.
- `Plain<T>` (ADR-0009) must be able to strip brands back to their base type for serialization; the `Brand<Base, Tag>` shape enables a generic `Unbrand<T>` via conditional type inference.
- Each new branded domain value needs a type alias plus a namespace with at least `create`/`from` (ADR-0007) — `Id` and `Email` are the reference implementations to copy.
- `Currency` (e.g. `USD`, `BRL`, per ADR-0002) is a plain string-literal union, not a branded type — its value set is closed and small enough that a union already gives exhaustiveness, branding would add nothing.

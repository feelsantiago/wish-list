# Literal-field discriminated narrowing for Plan-gated types

We narrow `User` into `ProUser`/`FreeUser` using the existing `plan: 'free' | 'pro'` field itself as the discriminant (`ProUser = User & { plan: 'pro' }`), rather than introducing a synthetic `_tag` field as ADR-0008 does for `Item`'s Extraction Status. This lets Pro-only function signatures (e.g. a future `trackItem(user: ProUser)`) get compile-time enforcement — a `FreeUser` can't be passed where a `ProUser` is required — without adding a field that would just duplicate `plan`'s value.

This differs from ADR-0008's case in two ways that make `_tag` unnecessary here: `ProUser`/`FreeUser` have no shape difference beyond the literal value of `plan` (no variant has extra/missing fields), and there's no naming collision with another domain-meaningful field (ADR-0008 needed `_tag` specifically because `Item.status`, Wanted/Fulfilled, would otherwise collide with Extraction Status). TypeScript narrows on any literal-typed property used as a discriminant, so `plan` already does the job `_tag` does for `Item`.

## Considered options

- **`_tag` convention (ADR-0008's approach), applied uniformly**: consistent with `Item`, but for `User` it would add a field that's redundant with `plan` — nothing distinguishes `ProUser` from `FreeUser` that `plan` doesn't already say. Rejected for this case.
- **Runtime Guard functions only** (`isPro(user): boolean`), no type narrowing: a function like `trackItem` couldn't statically require a Pro user — the check would live inside every call site's body instead of the signature, and nothing stops a `FreeUser` from being passed in and only failing at runtime. Rejected — the goal is enforcing the rule via types.
- **Literal-field narrowing (chosen)**: `User = ProUser | FreeUser`, discriminated on `plan` directly. No extra field, `create`/`from`/`plain` (ADR-0007) operate on the union `User` type unchanged, and `Plain<T>` (ADR-0009) distributes over it automatically.

## Consequences

- This pattern applies only when variants are shape-identical and the discriminating field has no naming collision with another domain concept. A future entity whose states genuinely differ in shape (like `Item`'s) still uses ADR-0008's `_tag` convention, not this one.
- `User.create()` always produces a `FreeUser` (new accounts start on Free) — its return type can be narrowed to `Result<FreeUser, DomainFailure>` rather than the wider `User` union.
- Enforcement *behavior* (Guard classes, `plan.track(user)`-style checks) is a separate decision from this narrowing mechanism — this ADR covers only the types, not how Plan-gated logic is implemented (see PRD-0003, deferred).

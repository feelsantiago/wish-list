# Failure as universal error type

We use a single `Failure<T extends string = 'Failure'>` class (ported into `libs/common/error`) as the error type `E` in every `Result<T, E>` (ADR-0005) across the codebase. `Failure` extends `Error`, carries a typed `name` via its generic, holds `Record<string, unknown>` metadata, and chains causally via a `source` field (`Failure | Error | undefined`). Domain-specific error data lives in metadata, not in separate error classes — a zod validation failure inside `Item.create()` becomes `Failure<'validation'>` with `{ issues }` metadata, an LLM extraction failure becomes `Failure<'extraction-failed'>` with `{ url, cause }` metadata, a Coupon Rule with no matching Item becomes `Failure<'no-match'>`, and so on — one class, many typed names.

This gives every fallible function signature a documented failure mode (`Result<Item, Failure<'validation'>>`), a uniform way to add causal context as errors propagate (`.context()`), and pairs naturally with `ts-pattern` for exhaustive matching on `failure.name` at the boundary where an API layer needs to turn a domain failure into an HTTP status.

## Considered options

- **Typed error unions per call site** (`Result<T, ValidationError | NotFoundError | ...>`): explicit, but combinatorial as errors propagate through several layers (database → service → API), and no standard way to chain causes. Rejected.
- **Plain strings as `E`**: minimal boilerplate, but no structured metadata, no causal chain, error identity is string matching. Rejected.
- **Error subclass per failure kind** (`class ValidationError extends Error`, `class NotFoundError extends Error`, ...): familiar, but a growing subclass zoo with no uniform chain/context mechanism, and every new failure kind is a new class + import. Rejected.
- **Single `Failure` class (chosen)**: one type everywhere; the generic `T` gives compile-time name discrimination without a new class per kind; causal chain via `source`; fluent immutable `.context()`/`.metadata()` composition.

## Consequences

- Every `Result<T, E>` in the codebase converges on `Failure<'some-name'>` as `E`. `DomainFailure` (`libs/domain`) is a thin alias/factory layer over `Failure` for domain-specific names (`validation`, `not-found`, `extraction-failed`), matching so-sick's `DomainFailure` pattern.
- `Failure.from()` is the sanctioned boundary between a thrown exception and Result-land — it's where `Result.fromThrowable`'s `mapErr` lands, replacing ad-hoc error conversion at each call site.
- `ts-pattern` becomes a workspace-wide dependency, used both for `Failure.name` matching and generally for discriminated-union matching (ADR-0008).
- At the `apps/api` boundary, a single mapping function translates `Failure.name` → HTTP status (e.g. `validation` → 400, `not-found` → 404) via one `ts-pattern` match — new failure names must be added there or they fall through to a 500 default, which is the intended forcing function.

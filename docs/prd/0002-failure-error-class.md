## Problem Statement

Per ADR-0010, the codebase enforces `Result<T, E>` (PRD-0001) for all error handling, but the error type `E` is unconstrained at that package's level. Without a standard error type, domain code invents its own shape per feature (a `ValidationError[]` here, a plain string there), making cross-cutting concerns — logging, tracing, turning a domain failure into an HTTP status in `apps/api` — inconsistent across `libs/domain`, `libs/database`, and every feature `service` lib.

## Solution

Create `libs/common/error`, providing a single `Failure<T extends string = 'Failure'>` class as the universal error type for all `Result<T, E>` usage. `Failure` supports causal chaining via a `source` field, structured metadata, fluent immutable composition, and colorized console rendering through a separate `FailureRenderer` abstraction. Ported from a prior project's `@so-sick/error` package.

## User Stories

1. As a developer, I want a single error class used across the entire application, so that error handling is consistent regardless of which lib I'm in.
2. As a developer, I want `Failure.from(string)` to create a Failure from a message, so that I can quickly create errors with minimal boilerplate.
3. As a developer, I want `Failure.from(string, metadata)` to create a Failure with metadata in one call, so that I can attach structured context at creation time (e.g. `{ url }` for an extraction failure).
4. As a developer, I want `Failure.from(Error)` to wrap a native Error, copying its message and storing the original as `source`, so that third-party exceptions (the libsql driver, the LLM client SDK) are captured without information loss.
5. As a developer, I want `Failure.from(Error, metadata)` to wrap a native Error with metadata, so that I can annotate external errors with application context at the boundary.
6. As a developer, I want `Failure.from(unknown)` to handle arbitrary thrown values, stringifying them as the message, so that catch boundaries never fail to produce a Failure.
7. As a developer, I want `Failure.from(existingFailure)` to return the same instance (identity), so that wrapping an already-handled Failure doesn't create unnecessary nesting.
8. As a developer, I want `Failure.from<'DbError'>(existingFailure)` with an explicit generic to wrap the Failure with a new name, so that I can retype errors when crossing a layer boundary (e.g. `libs/database` retyping a driver error before it reaches a `service` lib).
9. As a developer, I want `Failure<T extends string = 'Failure'>` with a generic parameter, so that `failure.name` is strongly typed and pattern-matchable with `ts-pattern`.
10. As a developer, I want the generic default to be `'Failure'`, so that untyped failures mirror the native `Error.name` convention.
11. As a developer, I want `.context(message)` to return a new Failure wrapping the current one as `source`, so that I can add causal context as errors propagate up through `service` → `apps/api`.
12. As a developer, I want `.context(message, metadata)` to accept optional metadata on the new context layer.
13. As a developer, I want `.context<'NewName'>(message)` to optionally override the error name, so that I can retype errors at domain boundaries.
14. As a developer, I want `.context()` to default to the source's name when no generic is provided.
15. As a developer, I want `.metadata(data)` to return a new Failure with shallow-merged metadata, so that I can incrementally annotate errors in a fluent chain.
16. As a developer, I want `.metadata<'NewName'>(data)` to optionally override the error name while annotating.
17. As a developer, I want metadata to shallow-merge with later keys winning on conflict.
18. As a developer, I want all fluent methods to return new immutable instances, so that a Failure reference can be passed around safely.
19. As a developer, I want `.context()` to start with empty metadata on the new layer, so each chain node owns only its own context.
20. As a developer, I want `source` typed as `Failure | Error | undefined`, so native Errors sit naturally at the leaf of the chain.
21. As a developer, I want stack traces captured on `Failure.from()` and `.context()` only (not `.metadata()`), so stacks point to meaningful boundaries rather than annotation call sites.
22. As a developer, I want `.toString()` to produce a plain-text chain format (no ANSI codes), so template literals and non-terminal logging get structured output automatically.
23. As a developer, I want `.toString()` output to show each chain level with name, message, and metadata at correct indentation.
24. As a developer, I want a `FailureRenderer` interface with `render(failure): string` and `print(failure): void` (ADR-0011), so formatting is decoupled from the Failure class.
25. As a developer, I want a `ConsoleRenderer` class implementing `FailureRenderer`, so I get colorized error chain output in local development out of the box.
26. As a developer, I want `ConsoleRenderer`'s color scheme (top bold+red, nested bold+yellow, leaf native Error bold+magenta, metadata keys cyan, values gray, stacks dim) so the chain hierarchy is scannable at a glance.
27. As a developer, I want `ConsoleRenderer` to accept constructor config `{ stacks: boolean }`, so I can configure verbose output per environment.
28. As a developer, I want per-call config override on `render()`/`print()`.
29. As a developer, I want `ConsoleRenderer.print()` to output via `console.error`.
30. As a developer, I want renderers importable from a separate entrypoint so the main package stays free of `picocolors` (ADR-0011) — `apps/api` in particular shouldn't need a terminal-color dependency in its production request path.
31. As a developer, I want to use Failure with `Result.fromThrowable` via `.mapErr()`: `Result.fromThrowable(() => ...).mapErr(e => Failure.from<'Name'>(e).metadata({ ... }))`.
32. As a developer, I want `Failure` to work with `ts-pattern` matching on `failure.name`, so I can exhaustively map domain failures to HTTP statuses in `apps/api` (ADR-0010).
33. As a developer, I want everything importable from a single barrel (`import { Failure } from '@wish-list/common-error'`).

## Implementation Decisions

- **Package location:** `libs/common/error`, generated the same way as `libs/common/result` (PRD-0001).
- **Source of truth for the port:** so-sick's `packages/common/error/src/lib/{failure,failure-renderer,console-renderer}.ts` and its two-entrypoint `index.ts`/`renderers.ts` split — copy structure and behavior, adjusting only package name/import path.
- **Two entrypoints:** main package exports `Failure` and types, zero formatting dependencies. A `renderers` subpath exports `FailureRenderer` and `ConsoleRenderer` (depends on `picocolors`).
- **`Failure<T extends string = 'Failure'>` extends `Error`.**
- **`source: Failure | Error | undefined`**, matched via `ts-pattern`/`instanceof`.
- **`metadata: Record<string, unknown>`**, unstructured by design — consumers cast after matching on `failure.name`. Shallow merge, later keys win.
- **Immutable fluent API** — `.context()`/`.metadata()` always return new instances.
- **Name inheritance** — both fluent methods inherit the source's name by default; explicit generic override signals intentional retyping.
- **Stack capture** on `.from()`/`.context()` only.
- **`Failure.from()` identity rule** — an existing `Failure` without an explicit generic returns as-is.
- **Dependencies:** `ts-pattern` (workspace-wide, ADR-0010), `picocolors` (renderers entrypoint only), `tslib`.
- **`libs/domain`'s `DomainFailure`** (ADR-0006/0007/0010) is a thin factory layer over this package's `Failure` — `DomainFailure.validation(input, zodError)` returns `Failure<'validation'>` with `{ issues }` metadata, mirroring so-sick's `domain-failure.ts`.

## Testing Decisions

- Port `failure.spec.ts` and `console-renderer.spec.ts` from so-sick as the starting suite, verifying behavior is unchanged after the port.
- Assert on public surface: `.name`, `.message`, `.metadata`, `.source`, `.toString()` output, renderer output strings — never internal state.
- Test runner: Vitest.

## Out of Scope

- Migrating any domain code to use `Failure` — this PRD only creates the package; wiring it into `libs/domain` entities happens as each entity is built (ADR-0007).
- ESLint rule enforcing Failure as the sole `E` type — convention + review for now.
- Additional renderers (JSON/structured-log) — deferred until `apps/api`'s logging story is decided (ADR-0011).
- Logger integration — `ConsoleRenderer` uses `console.error` directly; pino/winston integration is separate.

## Further Notes

- ADR-0010 documents the decision to use Failure as the universal error type; ADR-0011 documents the renderer split.
- Ported from so-sick's `docs/prd/0002-failure-error-class.md` / `packages/common/error` — see that repo for the reference implementation.
- Depends on `libs/common/result` (PRD-0001) only at integration points (`.mapErr()` usage in examples), not as a hard runtime dependency of the `Failure` class itself.

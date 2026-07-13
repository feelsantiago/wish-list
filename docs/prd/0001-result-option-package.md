## Problem Statement

Per ADR-0005, the codebase has no standard mechanism for handling errors as values. Without one, developers default to try/catch — which hides error paths from return types, lets callers silently ignore failures, and forces nested blocks for multi-step composition. Nullable values (`null`/`undefined`) suffer a similar problem: nothing in the type system forces the caller to handle the absent case. This matters early because `libs/domain` and `libs/database` are the first packages to be written, and every entity's `create()` (ADR-0007) needs a return type for validation failure from day one.

## Solution

Create `libs/common/result`, providing `Result<T, E>`, `AsyncResult<T, E>`, and `Option<T>`. These make errors and absence first-class values the type system forces callers to handle. All new application code uses these types instead of try/catch or raw null checks. Ported from a prior project's `@so-sick/result` package — same API surface, same file organization, republished under this workspace's own scope.

## User Stories

1. As a developer, I want to return `Result<T, E>` from fallible functions, so that callers see possible failures in the type signature and must handle them.
2. As a developer, I want `Result.ok(value)` and `Result.err(error)` constructors on the Result namespace, so that creating results is consistent with AsyncResult's API.
3. As a developer, I want standalone `ok()` and `err()` shortcut functions re-exported from the package, so that I can use the shorter form when preference or context warrants it.
4. As a developer, I want `Result.fromThrowable(fn, mapErr)` to wrap sync code that might throw, so that try/catch is confined to the boundary and never appears in business logic.
5. As a developer, I want `Result.safeTry(function* () { ... })` to write multi-step sync operations with generator-based early returns, so that I avoid nested `andThen` chains.
6. As a developer, I want `Result.safeTry(this, async function* () { ... })` with a `this`-binding overload, so that I can access class members inside generator bodies without workarounds.
7. As a developer, I want `.map()`, `.mapErr()`, `.andThen()` on Result instances, so that I can transform and chain results fluently.
8. As a developer, I want `.match({ ok, err })` on Result instances, so that I can exhaustively handle both cases and get a single return value.
9. As a developer, I want `.unwrapOr(default)` and `.unwrapOrElse(fn)` on Result instances, so that I can extract values with explicit fallbacks.
10. As a developer, I want `.inspect()` and `.inspectErr()` on Result instances, so that I can add logging side-effects without changing the result.
11. As a developer, I want `.isOk()` and `.isErr()` type guards on Result instances, so that TypeScript narrows the type in conditional branches.
12. As a developer, I want `.ok()` and `.err()` methods on Result instances that return `Option<T>` and `Option<E>`, so that I can bridge from Result to Option when I want to discard one side.
13. As a developer, I want `AsyncResult<T, E>` as a class wrapping `Promise<Result<T, E>>` with chainable methods, so that I can compose async fallible operations fluently — this is the type most of `apps/api`'s service layer and every `libs/database` repository will return.
14. As a developer, I want `AsyncResult.fromThrowable(fn, mapErr)` to wrap async/promise-returning code that might throw, so that the try/catch boundary is handled once at the edge (e.g. wrapping the Turso/libsql client and the LLM extraction client, per ADR-0001/0005).
15. As a developer, I want `AsyncResult.fromPromise(promise, mapErr)` to wrap an existing promise into an AsyncResult, so that I can integrate with promise-based APIs.
16. As a developer, I want `AsyncResult.fromResult(result)` to lift a sync Result into an AsyncResult, so that I can mix sync and async results in the same chain.
17. As a developer, I want `.toPromise()` on AsyncResult to convert back to `Promise<Result<T, E>>` (the `ResultAsync` type alias), so that NestJS controller/service public methods return plain promises.
18. As a developer, I want `Option<T>` as a union of `Some<T> | None` with a full method set, so that nullable domain values (e.g. an Item's optional Category) get the same composability and safety as Result.
19. As a developer, I want `Option.some(value)`, `Option.none()`, and `Option.from(nullable)` constructors, so that I can create Options from known values or nullable sources.
20. As a developer, I want `Option.fromThrowable(fn)` to catch exceptions and return None, so that I can wrap throwable code where I only care about presence/absence.
21. As a developer, I want `.map()`, `.andThen()`, `.filter()` on Option instances, so that I can transform and chain optional values.
22. As a developer, I want `.match({ some, none })` on Option instances, so that I can exhaustively handle both cases.
23. As a developer, I want `.unwrapOr(default)` and `.unwrapOrElse(fn)` on Option instances, so that I can extract values with fallbacks.
24. As a developer, I want `.isSome()` and `.isNone()` type guards on Option instances, so that TypeScript narrows the type in conditional branches.
25. As a developer, I want `.okOr(err)` and `.okOrElse(fn)` on Option instances to convert `Option<T>` to `Result<T, E>`, so that I can bridge from Option to Result when absence is an error (e.g. "Wishlist not found" from a repository lookup).
26. As a developer, I want `.inspect()` on Option instances, so that I can add logging without changing the value.
27. As a developer, I want `ResultAsync<T, E>` as a type alias for `Promise<Result<T, E>>`, so that public method signatures document intent without requiring the full AsyncResult class.
28. As a developer, I want everything importable from a single barrel (`import { Result, AsyncResult, Option, ok, err } from '@wish-list/common-result'`), so that imports stay simple.

## Implementation Decisions

- **Package location:** `libs/common/result`, generated via Nx's JS/TS library generator with `--directory=libs/common/result`, `--importPath=@wish-list/common-result` (final import path/scope to be confirmed against whatever `@wish-list/*` convention the workspace settles on when the lib is actually generated), `--unitTestRunner=vitest`.
- **Source of truth for the port:** `so-sick`'s `packages/common/result/src/lib/{result,async-result,option,types}.ts` — copy structure and behavior; adjust only the package name/import path, nothing in the API surface.
- **Result namespace pattern:** `Result` is both a TypeScript type (`Ok<T,E> | Err<T,E>`) and a value namespace via declaration merging. Static methods (`ok`, `err`, `fromThrowable`, `safeTry`) live on the namespace object. `ok` and `err` are also re-exported as standalone functions.
- **AsyncResult is a class**, not a type alias. Wraps `Promise<Result<T,E>>` and provides chainable instance methods (`map`, `mapErr`, `andThen`, `inspect`, `inspectErr`, `match`, `unwrapOr`). Static factories: `fromThrowable`, `fromPromise`, `fromResult`.
- **`ResultAsync` is a type alias only** — `type ResultAsync<T, E> = Promise<Result<T, E>>`. No runtime code.
- **Option mirrors Result's shape**, with namespace statics (`some`, `none`, `from`, `fromThrowable`) and full instance method set.
- **Bridge methods both directions**: `Result.ok()`/`.err()` → `Option`; `Option.okOr()`/`.okOrElse()` → `Result`.
- **`safeTry` supports `this`-binding** via overloaded signature.
- **Error type `E` is unconstrained** at this package's level — `libs/domain`/`libs/database`/services constrain it to `Failure<T>` per ADR-0010, but this package itself stays generic.
- **No `AsyncOption`** — deferred until a real need emerges, same rationale as the source project.
- **Single barrel export** from `index.ts`. No subpath exports.
- **File organization:** `result.ts`, `async-result.ts`, `option.ts`, `types.ts`, `index.ts`.

## Testing Decisions

- Good tests exercise the public API — call `Result.ok()`, chain methods, assert output. Never assert internal class state.
- Port the four spec files from so-sick (`result.spec.ts`, `async-result.spec.ts`, `option.spec.ts`, `types.spec.ts`) as the starting test suite, verifying behavior is unchanged after the port.
- Test runner: Vitest (ADR-0003).
- These tests establish the testing pattern for every subsequent `libs/common/*` and `libs/domain` package.

## Out of Scope

- `AsyncOption<T, E>` — deferred.
- ESLint rule to enforce no-try-catch — convention + code review for now.
- NestJS/Angular-specific adapters (e.g. an exception filter that unwraps a Result into an HTTP response) — separate work, likely lands with the first `apps/api` feature module.

## Further Notes

- ADR-0005 documents the decision to use Result types over try/catch.
- Ported from `so-sick`'s `docs/prd/0001-result-option-package.md` / `packages/common/result` — see that repo for the reference implementation to copy from directly.
- `libs/common/error` (PRD-0002) depends on this package's `Result` type for its own error class's integration points.

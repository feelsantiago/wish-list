# Result types instead of try/catch for error handling

We use `Result<T, E>` and `AsyncResult<T, E>` (from `libs/common/result`) as the standard error-handling mechanism across the domain layer, database layer, and API services. Try/catch is not allowed in application code.

Try/catch makes error paths invisible in return types, lets callers silently ignore failures, and forces nested blocks for composition. `Result` makes errors values — the type system enforces handling, operations compose via `.map()` / `.andThen()` / `safeTry`, and every function signature documents its failure modes. This matters more here than in a typical CRUD app because a lot of wish-list's logic is inherently fallible in ways worth surfacing in the type: LLM extraction can fail or return partial data, Coupon Rule matching can fail to find a match, price fetches can fail transiently.

Ported from a prior project (`@so-sick/result`) rather than an npm dependency, matching that project's own rationale: full control over the namespace-style API (`Result.ok()`, `Result.safeTry()`) and a companion `Option<T>` type, which off-the-shelf libraries like `neverthrow` don't provide together.

## Considered options

- **try/catch (status quo)**: familiar, zero new concepts, but error paths are invisible in signatures and forgotten catches crash at runtime. Rejected.
- **neverthrow**: established, similar API, but lacks the namespace-style ergonomics and built-in `Option<T>` we want. Rejected.
- **Effect-TS**: comprehensive but far heavier than this codebase needs. Rejected.
- **Port `@so-sick/result` as `libs/common/result` (chosen)**: already battle-tested in a prior project, framework-agnostic, no new library to vet.

## Consequences

- All new code in `libs/domain`, `libs/database`, and every `libs/*/service` must use `Result`/`AsyncResult` for fallible operations. No new try/catch blocks.
- `Result.fromThrowable` / `AsyncResult.fromThrowable` wrap third-party/SDK calls that throw (the LLM extraction client, the Turso/libsql driver, `fetch` for price checks) — the try/catch boundary lives there, not in business logic.
- `Option<T>` replaces raw `null`/`undefined` checks for genuinely optional domain values (e.g. an Item's optional Category).
- `libs/common/result` becomes a workspace dependency of `libs/domain`, `libs/database`, and every feature `service` lib.

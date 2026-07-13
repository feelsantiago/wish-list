# Renderer abstraction for Failure formatting

Failure formatting (ADR-0010) is handled by a `FailureRenderer` interface with concrete implementations, ported into `libs/common/error`, not by methods on `Failure` itself. `Failure` owns `.toString()` for plain-text chain output (safe for logs, serialization, template literals). Colorized, environment-specific rendering is delegated to renderer classes (e.g. `ConsoleRenderer`), keeping `Failure` free of formatting dependencies.

`libs/common/error`'s main entrypoint exports `Failure` and stays dependency-light; a separate `libs/common/error/renderers` (or equivalent subpath) exports `FailureRenderer` and `ConsoleRenderer`, which pulls in `picocolors`. This matters for `apps/api`, which should never need a terminal-color dependency in a production request path just because it imports `Failure`.

## Considered options

- **Instance method on `Failure`** (`failure.print()`): convenient, but couples `Failure` to one output target and forces a color-library dependency into the core error class. Rejected.
- **Standalone function** (`printFailure(f)`): decoupled, but no extension point for multiple output formats (console vs. future structured-log renderer). Rejected.
- **Renderer interface with concrete classes (chosen)**: `FailureRenderer` defines `render(failure): string` / `print(failure): void`; `ConsoleRenderer` is the first implementation. Constructor config with per-call override (e.g. whether to include stack traces).

## Consequences

- `libs/common/error`'s core entrypoint has zero formatting dependencies; only the renderers subpath adds `picocolors`.
- `ConsoleRenderer` is a CLI/local-dev tool primarily — `apps/api` in a real environment should prefer a structured-log renderer (JSON) once one exists, so error chains are queryable rather than colorized strings. Not built yet; add when the logging story is decided, per the domain and database layers landing first (ADR-0004's sequencing).
- `.toString()` on `Failure` remains the fallback everywhere a renderer isn't wired up yet (early development, tests) — always available, never throws on missing formatting deps.

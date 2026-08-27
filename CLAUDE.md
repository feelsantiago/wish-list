<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# Code Style

- No `try`/`catch` in `libs/domain` (or anywhere `Result` is idiomatic). Use `Result.fromThrowable` and chain `.map`/`.mapErr`/`.unwrapOr` instead.
- No `switch` statements on discriminated unions. Use `ts-pattern`'s `match(...).with(...).exhaustive()` instead.
- Prefer `ts-pattern`'s `match(...).with(...)` over `if`/`else` chains or ternaries that branch on a value's type or shape (e.g. `typeof x === ...`, `Array.isArray(x)`, `x === undefined`).
- No bare `null`/`undefined` for absent values. Use `Option` from `@wish-list/common-result` (`Option.from`, `.map`, `.okOr`/`.okOrElse`, etc.) instead.
- No top-level helper functions in files exporting a class. Class is top-level structure — put helpers as `private` methods on class instead.
- No loose `Failure.create`/`Failure.from` calls scattered in reader/service files, and no inline `Failure<'a' | 'b'>` unions repeated across files. Each failure type gets its own file (e.g. `reading-failure.ts`, `page-fetcher-failure.ts`) exporting a type alias plus a same-named namespace of factory functions (e.g. `ReadingFailure.noStructuredData()`), following the existing `ExtractionFailure` pattern. Consumers import the type/namespace, never call `Failure.create` directly.

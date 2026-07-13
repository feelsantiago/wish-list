# Monorepo layout and core tooling

The workspace starts as a bare Nx + npm setup with only `@nx/js` and a flat `packages/*` glob. Before any app code lands, we fix baseline tooling so later packages are added consistently rather than each improvising its own conventions. Library organization itself (the `apps/` + `libs/` split and its internal shape) is covered separately in ADR-0004 — this ADR is tooling only.

**Package manager**: Keep npm (already in use via `package-lock.json` and npm workspaces) — no reason to switch mid-setup.

**Test runner**: Vitest. ESM-native, fast, and mocks the libsql/Turso client more easily than Jest's CJS-oriented transform pipeline. Use `@nx/vite` for the Nx integration where applicable; NestJS's own testing utilities (`@nestjs/testing`) run fine under Vitest.

**Lint**: ESLint flat config via `@nx/eslint`, with `@nx/enforce-module-boundaries` turned on from the start. This is the mechanism that enforces the layering rules set out in ADR-0004 (e.g. `libs/domain` staying framework-free, feature `ui` libs never reaching into another feature's `data`/`service` libs) by tags, not just convention.

**CI**: GitHub Actions, using `nx affected` to only build/test/lint what changed per PR. Deferred until the repo has actual projects to run — the workflow will be scaffolded alongside the first app.

**Data layer tooling**: Drizzle ORM with the `@libsql/client` driver, targeting Turso. Drizzle's schema-as-code is close to raw SQL (matches SQLite's feature set exactly, no ORM abstraction leaking) and its migration tool works directly against a libsql connection without a separate database daemon. Rejected Prisma (heavier client, weaker/newer SQLite-over-libsql support at time of writing) and a raw libsql client (no schema-driven types, hand-rolled migrations).

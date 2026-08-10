# Feature-based library organization

> **Amended by ADR-0025.** Controllers moved out of `service` libs into `apps/api`; the
> cross-feature rule was replaced (services use repositories directly and never import
> other services); `vendor` was dropped from the slice list; `libs/extraction` was added
> as a horizontal lib. The text below reflects those amendments.

Libraries are organized by feature (vertical slice) rather than by technical layer alone. Each feature gets up to three libs — `data`, `service`, `ui` — sitting alongside four cross-cutting horizontal libs shared by all features: `common`, `domain`, `database`, `extraction`.

```
libs/
  common/            framework-agnostic infra: Result/Option/AsyncResult, Failure — see ADR-0005, ADR-0010
  domain/            DDD domain layer: branded value types, entities, business rules — see ADR-0006..0009
  database/          Drizzle schema + Turso/libsql client, repository implementations
  extraction/        page fetch + structured-data/LLM extraction, Vendor lifecycle — see ADR-0023..0025
  <feature>/
    data/            DTOs/contracts shared between that feature's service and ui libs (request/response shapes, not domain entities)
    service/         application services for that feature — no controllers, no HTTP vocabulary (ADR-0025)
    ui/               Angular modules/components for that feature
```

Initial feature slices, derived from the `CONTEXT.md` glossary: `account` (User, Plan), `wishlist`, `item` (Item, Extraction Status), `category`, `coupon` (Coupon, Coupon Rule, Effective Price), `sharing` (Sharing, Reservation, Surprise Mode), `tracking` (Tracked Item, Price History). This list is a starting point, not a commitment — a feature only gets its `data`/`service`/`ui` trio scaffolded when work on it actually starts (per ADR-0003's tooling, via the `nx-generate` conventions), and two features can merge into one slice later if they turn out not to need independent boundaries. `vendor` was originally on this list and has been removed: Vendor has no user-facing lifecycle and is owned by `libs/extraction` (ADR-0025).

Horizontal infrastructure libs (`database`, `extraction`) are single libs, not `data`/`service`/`ui` trios. The trio exists so a feature's client and server halves can share DTOs across the API seam; an infrastructure lib has no client half and its data types are domain entities that already live in `libs/domain`.

## Dependency direction

```
apps/api  → libs/<feature>/service → libs/domain, libs/database, libs/extraction, libs/<feature>/data
apps/web  → libs/<feature>/ui      → libs/<feature>/data
libs/extraction → libs/domain, libs/database
libs/database   → libs/domain
libs/domain     → libs/common
```

- `libs/domain` never imports NestJS or Angular — it is the one layer both apps share unmodified.
- **`libs/domain` is the ubiquitous language of the system.** Layers communicate through domain types; every other lib derives its own types from domain types rather than restating them. `libs/<feature>/data` may import `libs/domain` **type-only**, deriving wire contracts from `Plain<T>` (ADR-0009) — so `libs/<feature>/ui` gets those types transitively with no domain code in the bundle.
- `libs/<feature>/ui` only ever imports its own feature's `data` lib, never another feature's `service`, and never `libs/domain`/`libs/database`/`libs/extraction` directly — the API is the seam between client and server, DTOs are what cross it.
- `libs/<feature>/service` and `libs/extraction` are the only places allowed to import `libs/database`. `apps/api` composes services; it does not talk to the database layer directly.
- **Services never import other services.** A feature's `service` lib depends on `libs/domain`, `libs/database`, `libs/extraction`, and its own `data` lib — and on nothing else in `libs/`. Cross-feature reads go through `libs/database`'s repositories directly. By convention (review-time, not lint-enforced): a feature's service owns *writes* to its own entities; other features may *read* any repository. See ADR-0025 for why the original "go through the other feature's service lib" rule was replaced.
- **Controllers live in `apps/api`**, not in `libs/<feature>/service`. Service libs stay API-agnostic so a CLI, cron worker, or queue consumer can use them unchanged (ADR-0020, ADR-0025).

The rules that can be enforced mechanically are — via `@nx/enforce-module-boundaries` tags (ADR-0003), so a violation is a lint failure rather than a review comment. The no-service→service rule is one of them, because service libs are separate Nx projects with separate tags; the write-ownership convention is not, because all repositories live in one `libs/database` project that boundary rules cannot see inside.

## Considered options

- **Flat `packages/domain` + `packages/common` (so-sick's current shape)**: simpler for a single-domain study project, but so-sick's own ADR-0001 already flags feature-based `data/server/ui` splits as the intended direction once the domain grows past one entity family. Wish-list's domain (8 feature areas from day one) is past that point already — rejected.
- **Layer-first (`libs/data`, `libs/api`, `libs/ui` each containing all features)**: keeps horizontal layers thin, but every feature's code is scattered across three unrelated top-level folders, and unrelated features share a lib boundary — a change to Coupon UI and Wishlist UI both touch `libs/ui`, so `enforce-module-boundaries` can't stop them from reaching into each other. Rejected.
- **Feature-based with cross-cutting `common`/`domain`/`database` (chosen)**: a feature's own concerns are colocated (`libs/coupon/*`), while genuinely shared concepts (branded types, Result/Failure, DB client) live once. Matches Nx's recommended shape for domain-driven monorepos and gives `enforce-module-boundaries` real feature seams to enforce.

## Consequences

- Scaffolding a new feature means generating up to three libs (`data`, `service`, `ui`), each tagged (e.g. `scope:coupon`, `type:data`) so boundary rules can be written generically (`type:ui` may depend on `type:data` in the same `scope`, never `type:service`/`type:database` outside it; `type:service` never depends on another `type:service`).
- Small features may not need all three — a feature with no client-visible UI yet only gets `data` + `service`; `ui` is added when the screen exists. Prefer omitting an empty lib over generating a stub.
- `libs/domain` and `libs/database` grow across all features rather than being duplicated per-feature — entities like `Item` are shared (a Coupon Rule needs to read `Item`, Tracking needs to read/write `Item`'s price history), and a per-feature domain split would force awkward re-exports or duplication.

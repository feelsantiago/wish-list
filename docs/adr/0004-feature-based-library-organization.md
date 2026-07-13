# Feature-based library organization

Libraries are organized by feature (vertical slice) rather than by technical layer alone. Each feature gets up to three libs — `data`, `service`, `ui` — sitting alongside three cross-cutting horizontal libs shared by all features: `common`, `domain`, `database`.

```
libs/
  common/            framework-agnostic infra: Result/Option/AsyncResult, Failure — see ADR-0005, ADR-0010
  domain/            DDD domain layer: branded value types, entities, business rules — see ADR-0006..0009
  database/          Drizzle schema + Turso/libsql client, repository implementations
  <feature>/
    data/            DTOs/contracts shared between that feature's service and ui libs (request/response shapes, not domain entities)
    service/         NestJS modules, controllers, application services for that feature
    ui/               Angular modules/components for that feature
```

Initial feature slices, derived from the `CONTEXT.md` glossary: `account` (User, Plan), `wishlist`, `item` (Item, Extraction Status), `vendor`, `category`, `coupon` (Coupon, Coupon Rule, Effective Price), `sharing` (Sharing, Reservation, Surprise Mode), `tracking` (Tracked Item, Price History). This list is a starting point, not a commitment — a feature only gets its `data`/`service`/`ui` trio scaffolded when work on it actually starts (per ADR-0003's tooling, via the `nx-generate` conventions), and two features can merge into one slice later if they turn out not to need independent boundaries.

## Dependency direction

```
apps/api  → libs/<feature>/service → libs/domain, libs/database, libs/<feature>/data
apps/web  → libs/<feature>/ui      → libs/<feature>/data
libs/database → libs/domain
libs/domain    → libs/common
```

- `libs/domain` never imports NestJS or Angular — it is the one layer both apps share unmodified.
- `libs/<feature>/ui` only ever imports its own feature's `data` lib, never another feature's `service` or `database` directly, and never `libs/domain`/`libs/database` directly — the API is the seam between client and server, DTOs are what cross it.
- `libs/<feature>/service` is the only place allowed to import `libs/database`. `apps/api` composes services; it does not talk to the database layer directly.
- Cross-feature calls (e.g. Coupon Rule matching needs to read Items) go through the other feature's `service` lib's public API, not its `database` repositories directly.

These rules are mechanical, not aspirational — enforced via `@nx/enforce-module-boundaries` tags (ADR-0003), so a violation is a lint failure, not a review comment.

## Considered options

- **Flat `packages/domain` + `packages/common` (so-sick's current shape)**: simpler for a single-domain study project, but so-sick's own ADR-0001 already flags feature-based `data/server/ui` splits as the intended direction once the domain grows past one entity family. Wish-list's domain (8 feature areas from day one) is past that point already — rejected.
- **Layer-first (`libs/data`, `libs/api`, `libs/ui` each containing all features)**: keeps horizontal layers thin, but every feature's code is scattered across three unrelated top-level folders, and unrelated features share a lib boundary — a change to Coupon UI and Wishlist UI both touch `libs/ui`, so `enforce-module-boundaries` can't stop them from reaching into each other. Rejected.
- **Feature-based with cross-cutting `common`/`domain`/`database` (chosen)**: a feature's own concerns are colocated (`libs/coupon/*`), while genuinely shared concepts (branded types, Result/Failure, DB client) live once. Matches Nx's recommended shape for domain-driven monorepos and gives `enforce-module-boundaries` real feature seams to enforce.

## Consequences

- Scaffolding a new feature means generating up to three libs (`data`, `service`, `ui`), each tagged (e.g. `scope:coupon`, `type:data`) so boundary rules can be written generically (`type:ui` may depend on `type:data` in the same `scope`, never `type:service`/`type:database` outside it).
- Small features may not need all three — a feature with no client-visible UI yet only gets `data` + `service`; `ui` is added when the screen exists. Prefer omitting an empty lib over generating a stub.
- `libs/domain` and `libs/database` grow across all features rather than being duplicated per-feature — entities like `Item` are shared (a Coupon Rule needs to read `Item`, Tracking needs to read/write `Item`'s price history), and a per-feature domain split would force awkward re-exports or duplication.

# Extraction owns the Vendor lifecycle; services never import services

ADR-0004 states that "cross-feature calls (e.g. Coupon Rule matching needs to read Items)
go through the other feature's `service` lib's public API, not its database repositories
directly", and describes those rules as "mechanical, not aspirational — enforced via
`@nx/enforce-module-boundaries` tags". Building the first service layer showed both
halves of that to be wrong in practice, so we replace the rule.

**Services never import other services.** A feature's `service` lib may depend on
`libs/domain`, `libs/database`, and `libs/extraction`, and on nothing else in `libs/`.
Cross-feature reads go through `libs/database`'s repositories directly. On top of that,
by convention: **a feature's service owns writes to its own entities; other features may
read any repository.**

**`libs/extraction` owns the Vendor lifecycle** — find-or-create by registrable domain,
and provisional→resolved promotion (ADR-0022). `CONTEXT.md` defines a Vendor as "derived
automatically from the URL's registrable domain the first time it's seen… Not a curated
allowlist": there is no user-facing Vendor creation flow, and extraction is the only
component that ever learns a Vendor's `name` and `currency`. `Extractor` returns a
persisted Vendor `Id` on both the success and failure paths, so no feature service ever
writes another feature's entity.

## Considered options

- **Keep ADR-0004's rule and build four service libs for the first slice.**
  `ItemService.create` needs Wishlist (ownership), Vendor (find-or-create), and Category
  (default Unsorted), so the "first service layer" would be `item`, `wishlist`, `vendor`,
  and `category` together. Faithful to the ADR, but it immediately creates a cycle —
  `item/service` needs `wishlist/service` for ownership while `wishlist/service` needs
  `item/service` to list a Wishlist's Items — resolvable only with NestJS `forwardRef`, a
  smell adopted on day one. Rejected.
- **Keep the rule and let `item/service` write Vendors itself.** Avoids the extra libs but
  breaks the write-ownership convention on the very first service, and duplicates Vendor
  resolution into Tracking later. Rejected.
- **Drop the rule; services use repositories, never each other (chosen).** The dependency
  graph becomes a DAG by construction: `service → {domain, database, extraction}`, with no
  service→service edges possible, so no cycle can ever arise.

## Consequences

- ADR-0004's rule was never lint-enforceable in the first place. It was written assuming
  per-feature database libs; what got built is a single horizontal `libs/database` that
  `service` is explicitly allowed to import wholesale. `@nx/enforce-module-boundaries`
  sees one lib with one tag and cannot distinguish `ItemRepository` from
  `WishlistRepository`. The replacement rule — no service→service edges — _is_
  mechanically enforceable, because service libs are separate Nx projects with separate
  tags.
- Write ownership is a review-time convention, not a lint rule. Accepted: the property
  worth protecting mechanically is acyclicity, and that is now structural.
- **`libs/vendor/*` is removed from ADR-0004's initial slice list and will likely never
  exist.** Vendor has no independent user-facing lifecycle to host.
- Feature `service` libs contain application services only. **Controllers live in
  `apps/api`**, not in `libs/<feature>/service`, contradicting ADR-0004's description of
  the `service` lib. Service libs stay API-agnostic — no HTTP vocabulary, no Nest
  controllers, no status mapping (ADR-0020) — so a CLI, cron worker, or queue consumer can
  use them unchanged.
- `libs/extraction` joins `common`/`domain`/`database` as a horizontal lib, and the
  dependency diagram gains `service → extraction` and `extraction → database`.

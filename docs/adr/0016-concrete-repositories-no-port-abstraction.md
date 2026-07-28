# Concrete repositories, no port abstraction

`libs/database` exports concrete repository classes (e.g. `ItemRepository`) that feature `service` libs import and call directly. There is no repository *interface* declared in `libs/domain` for `libs/database` to implement — this matches ADR-0004's dependency diagram as drawn, where `service` has a direct edge to both `libs/domain` and `libs/database`, with no port/adapter layer between them. NestJS's DI container still makes each repository swappable at the module-wiring level (a test module can `overrideProvider` a repository token), so the usual "fake it in tests" benefit of a port isn't lost — it's just achieved through Nest's own DI rather than a hand-written interface.

We considered defining repository interfaces in `libs/domain` (classic ports-and-adapters/hexagonal shape), which would let `service` depend on an abstraction instead of a concrete class and make swapping the persistence implementation a non-breaking change. Rejected for now: nothing in this codebase needs a second implementation of any repository, and CLAUDE.md's "no premature abstraction" guidance applies directly — a port only pays for itself once there's an actual need to swap or fake at that seam, and Nest's DI already covers the faking case without it.

## Consequences

- Adding a genuine second persistence backend (or a need to unit-test a `service` against an in-memory fake repository rather than Nest's DI override) is the trigger to revisit this — at that point, extract interfaces into `libs/domain` and have the concrete classes implement them.
- Repository method signatures are free to use Drizzle-specific types in their internals without an interface constraining them, but their public surface still returns `AsyncResult<Entity, DatabaseFailure>` (ADR-0018) so callers in `service` never see Drizzle-shaped errors.

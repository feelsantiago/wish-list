# Repository capabilities via interfaces and composition, not inheritance

`libs/database` originally exposed a single abstract `Repository<TEntity, TRow, TTable>`
base class providing `find`, `insert`, and `update` to all ten repositories. That was
correct when every entity was mutable. It is not: `PriceHistory` has no mutating function
in its domain namespace at all and yet exposes `update()`, and `Extraction` (ADR-0023) is
append-only by design. We replace the base class with capability interfaces plus free
functions:

```ts
export interface Readable<TEntity>   { find(id: Id): AsyncResult<TEntity, DatabaseFailure>; }
export interface Insertable<TEntity> { insert(e: TEntity): AsyncResult<TEntity, DatabaseFailure>; }
export interface Updatable<TEntity>  { update(e: TEntity): AsyncResult<TEntity, DatabaseFailure>; }
export interface Deletable<TEntity>  { delete(id: Id): AsyncResult<void, DatabaseFailure>; }
```

```ts
@Injectable()
export class ExtractionRepository implements Readable<Extraction>, Insertable<Extraction> {
  public find(id: Id) { return find(this.options, id); }
  public insert(e: Extraction) { return insert(this.options, e); }
}
```

`ExtractionRepository.update` does not exist on the type. Calling it is a compile error,
it never appears in autocomplete, and there is no runtime throw to test for. Each
repository states its capabilities explicitly at the top of the class, where a reader
looking for "can this be mutated?" will actually look.

## Considered options

- **Keep the single base class, override `update` to throw.** Cheapest change. But it
  moves the error from compile time to runtime, keeps `update` in autocomplete inviting
  the mistake, and requires a test to prove the throw. Rejected.
- **A linear inheritance ladder** (`ReadRepository` → `AppendRepository` →
  `MutableRepository`). Preserves compile-time gating with minimal churn, but a chain can
  only express nested capability sets. `Reservation` needs read + insert + delete without
  update (ADR-0015: cancel means match the token, then delete), which no point on a linear
  chain describes. Rejected — the first real case already breaks it.
- **Mixin composition** (`class X extends Insertable(Readable(Base))`). Fully general and
  avoids delegation boilerplate, but TypeScript mixins combined with an abstract
  `mapper()` member and NestJS's `@Injectable()` constructor-parameter reflection produce
  constructor typing that is hard to read and harder to debug. Rejected as machinery out
  of proportion to the problem.
- **Interfaces + free functions over a shared options object (chosen).** Each repository
  declares its capabilities and delegates one line per method. More lines written, and
  every line states something true.

## Consequences

- Shared implementations are free functions taking `RepositoryOptions<TEntity, TRow,
  TTable>` (`{ db, table, mapper }`), not helper classes. This avoids each repository
  holding one to three helper instances that each duplicate a reference to the same
  `db`/`table`/`mapper`, and it matches how `libs/domain` already models behaviour —
  namespaces over plain functions, not class hierarchies (ADR-0007).
- Every repository carries per-method delegation boilerplate. This is the accepted cost:
  the alternative to writing `public insert(e) { return insert(this.options, e); }` is a
  base class that silently grants capabilities nobody asked for.
- `PriceHistoryRepository` loses `update`. That is a correctness fix, not a cosmetic one
   — nothing should have been able to rewrite an append-only price log.
- `ReservationRepository` gains `Deletable`, the capability that motivated abandoning the
  inheritance ladder.
- ADR-0016 (concrete repositories, no port abstraction) is unaffected. These interfaces
  are capability declarations inside `libs/database`, not ports for `service` to depend on
  instead of concrete classes — service libs still import `ItemRepository`, not
  `Readable<Item>`.

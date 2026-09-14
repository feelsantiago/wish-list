## Problem Statement

The database layer has no general way to say "this query is on behalf of a User".

The current answer is `findForUser(user, id)`, added to `WishlistRepository` and
`CategoryRepository` alongside a `ReadableForUser<TEntity>` capability. It works, but it
doesn't generalize in any direction:

- **It scales by method name, not by argument.** Every owned repository × every operation
  needs a `ForUser` twin — `findForUser`, `updateForUser`, `deleteForUser` across
  Wishlist, Category and Coupon is nine methods that differ from their unscoped siblings
  by one `and(...)` clause.
- **It only covers reads.** Nothing narrows an `UPDATE` or a `DELETE`, so a service that
  wants a safe update must `findForUser` then `update`, which is two statements and
  reintroduces the gap `findForUser` was meant to close.
- **It names the actor, not the mechanism.** `findForUser` hard-codes that the narrowing
  is by user. The narrowing is a `WHERE` fragment; who supplies it is the caller's
  business.

Underneath sits a second problem the first one keeps running into. Singular reads report
absence through the failure channel: `find` returns `AsyncResult<TEntity,
DatabaseFailure>` and errs with `DatabaseFailure.notFound(id)`. Services map the whole
`DatabaseFailure` channel wholesale — `ItemService` does `.mapErr(ServiceFailure.unexpected)` —
so any caller that actually wants *not found* semantics has to fish a `'not-found'` tag
back out of a union it has otherwise decided is an internal error. `findForUser` sidestepped
this by returning `Option<TEntity>` instead, leaving the two read paths of the same
repository disagreeing about what absence is. `VendorRepository.findByVendorDomain` and
`ExtractionRepository.findLatestByKey` disagree a third way, each hand-rolling
`Failure.create('not-found', …)` inline — which CLAUDE.md forbids outright.

## Solution

**`QueryScope<TTable>`: a caller-constructed `WHERE` fragment, passed as an argument to
repository operations.** Repositories never decide who may read or write anything. The
caller states the narrowing it wants; the repository applies it verbatim.

```ts
this.wishlists.find(input.wishlist, QueryScope.user(input.user));
this.wishlists.update(edited, QueryScope.user(actor));
this.wishlists.delete(id, QueryScope.user(actor));

this.wishlists.find(id, QueryScope.all());   // deliberately unscoped, and it says so
```

A row excluded by the scope is indistinguishable from a row that doesn't exist — both are
`None`. That is the whole security model: there is no active protection, no refusal, and
no "exists but not yours" signal. A caller that wants to call it "not yours" does so in
its own vocabulary, at its own layer.

Absence therefore stops being a failure everywhere:

```ts
find(id: Id, scope: QueryScope<TTable>): AsyncResult<Option<TEntity>, DatabaseFailure>;
```

`Some` means found and in scope. `None` means absent or out of scope. `Err` is reserved
for things that are genuinely the database's fault — `constraint`, `query`, `mapping`.
`DatabaseFailureType` loses `'not-found'` entirely.

### The type

```ts
// libs/database/src/lib/repository/query-scope.ts
export type UserOwnedTable = RepositoryTable & { readonly user: SQLiteColumn };

export interface QueryScope<TTable extends RepositoryTable> {
  // property syntax, NOT method shorthand — method shorthand is bivariant and
  // silently destroys the gating described below
  readonly condition: (table: TTable) => SQL | undefined;
}

export namespace QueryScope {
  export function all(): QueryScope<RepositoryTable> {
    return { condition: () => undefined };
  }

  export function user(user: Id): QueryScope<UserOwnedTable> {
    return { condition: (table) => eq(table.user, user) };
  }
}
```

`strict: true` gives us `strictFunctionTypes`, so the table parameter is contravariant and
does the gating for free:

- `QueryScope.all()` is a `QueryScope<RepositoryTable>` and flows into every repository.
- `QueryScope.user(u)` is a `QueryScope<UserOwnedTable>` and flows only into repositories
  whose table actually has a `user` column. `vendors.find(id, QueryScope.user(u))` fails
  to typecheck, and the error points at the missing column.

`QueryScope.all()` returning `undefined` means the free functions need no branch — Drizzle
drops `undefined` operands from `and(...)`:

```ts
.where(and(eq(options.table.id, id), scope.condition(options.table)))
```

### Capabilities

ADR-0021's capability interfaces gain scoped twins. A repository implements one side or
the other, never both:

```ts
export interface Readable<TEntity> {
  find(id: Id): AsyncResult<Option<TEntity>, DatabaseFailure>;
}

export interface ScopedReadable<TEntity, TTable extends RepositoryTable> {
  find(id: Id, scope: QueryScope<TTable>): AsyncResult<Option<TEntity>, DatabaseFailure>;
}
```

...and likewise `ScopedUpdatable` / `ScopedDeletable`. The scope argument is **required**
on the scoped side — there is no default. `wishlists.find(id)` is a compile error;
opting out is spelled `QueryScope.all()`, which is a word a reviewer can grep for. This
keeps the caller in charge (the repository still refuses nothing) while making "forgot to
scope" impossible to do silently.

Which repositories are scoped follows from the schema, not from taste:

| repository | scoping column | capability |
| --- | --- | --- |
| `wishlists`, `categories`, `coupons` | `user` | `Scoped*` |
| `items` | `wishlist` | unscoped (transitive — out of scope, see below) |
| `tracked_items`, `price_history`, `reservations` | `item` | unscoped (transitive) |
| `users`, `vendors`, `extractions` | none | unscoped, unchanged |

Unscoped repositories need no edit at all in slices 2 and 3: `Readable<Vendor>` keeps its
one-argument `find`.

## Slices

Three commits, landing in order. Each is independently revertible.

### Slice 1 — absence is `Option`

No `QueryScope` yet. This slice stands on its own merit even if the rest were abandoned.

- `find` (the free function in `operation.ts`, and the delegating method on all eleven
  repositories) returns `AsyncResult<Option<TEntity>, DatabaseFailure>`.
- `VendorRepository.findByVendorDomain` → `AsyncResult<Option<Vendor>, DatabaseFailure>`,
  dropping its inline `Failure.create('not-found', …)`.
- `ExtractionRepository.findLatestByKey` → `AsyncResult<Option<Extraction>, DatabaseFailure>`,
  same removal.
- `DatabaseFailure.notFound` is deleted. `DatabaseFailureType` becomes
  `'constraint' | 'query' | 'mapping'`.
- `DomainMapper`'s `domain(row: TRow | undefined, notFound: DatabaseFailure)` overload is
  deleted along with the three mapper implementations that forward to it
  (`coupon`, `coupon-rule`, `item`, `extraction`). Mapping a row that fails validation is
  still `err(DatabaseFailure.mapping(...))` — that is a real failure, distinct from absence.
- `VendorResolver.ensure` replaces `.orElse(match(error.name).with('not-found', …))` with
  an `Option` branch. `VendorResolver.provision`'s race-recovery re-find keeps a failure:
  a `None` immediately after a constraint violation is genuinely impossible, so it becomes
  `ExtractionFailure.persistFailed(...)`.
- Repository specs: `returns "notFound" when finding a missing id` becomes
  `returns None when finding a missing id`.

Nothing outside `libs/database` calls `find` today, so the migration is specs plus the one
`VendorResolver` site. This window closes as soon as more service libs land.

### Slice 2 — `QueryScope` on reads

- New `libs/database/src/lib/repository/query-scope.ts`, exported from the lib index.
- `ScopedReadable<TEntity, TTable>` added to `capability.ts`.
- `find` in `operation.ts` takes a `QueryScope<TTable>` and folds it into the `where`.
- `WishlistRepository`, `CategoryRepository` and `CouponRepository` switch from
  `Readable<T>` to `ScopedReadable<T, typeof table>`.
- `findForUser`, `ReadableForUser` and the `findForUser` free function are **deleted**.
  The HEAD commit's approach is replaced, not extended.
- `ItemService.checkWishlist` / `checkCategory` call
  `find(id, QueryScope.user(user))`. `checkExists` is unchanged — it already maps
  `None` to `ServiceFailure.notFound(resource)`, which is exactly the translation this
  design puts in the caller's hands.

### Slice 3 — `QueryScope` on mutations

- `ScopedUpdatable<TEntity, TTable>` and `ScopedDeletable<TTable>` added.
- `update` and `delete` narrow their `WHERE` by the scope and report the miss:

  ```ts
  update(entity: TEntity, scope: QueryScope<TTable>): AsyncResult<Option<TEntity>, DatabaseFailure>;
  delete(id: Id, scope: QueryScope<TTable>): AsyncResult<Option<Id>, DatabaseFailure>;
  ```

- Implemented with SQLite's `.returning()` — one statement, no read-then-write, no race.
  `None` means zero rows matched: absent, or out of scope.
- Unscoped `update`/`delete` keep their current return types on the eight unscoped
  repositories. Only the three owned repositories change shape.

## Implementation Decisions

1. **The scope's failure is `None`, not a failure value.** A scope never fails. There is no
   `QueryScope.must(...)`; `Option.okOr` already is that, at the seam where the caller knows
   the right words. A repository-side `must` would have had to fail into the
   `DatabaseFailure` channel, which every service maps wholesale to `unexpected` — so the
   caller would have had to pattern-match the tag back out, strictly more work than the
   `.okOr()` it replaced.
2. **`condition` is a property with a function type, not a method.** TypeScript method
   shorthand is bivariant in its parameters even under `strict`. Writing `condition(table:
   TTable): SQL | undefined` would let `QueryScope.user(u)` slip into `VendorRepository`
   and the compile-time gate would evaporate with no other symptom.
3. **The table generic defaults to `RepositoryTable`.** `Readable<Vendor>` keeps working
   unchanged, and the eight unscoped repositories are untouched by slices 2 and 3.
4. **Scoped repositories implement only the scoped capability.** They do not also implement
   `Readable`, or the one-argument `find` would be back and the required argument would be
   optional again in practice.
5. **`QueryScope` lives in `libs/database`, not `libs/domain`.** It *is* a `WHERE` fragment;
   modelling it as an abstract value object would mean translating it back into one
   immediately. Services already import concrete repositories from `@wish-list/database`
   (ADR-0016), so importing `QueryScope` from there crosses no new boundary.
6. **Ownership transfer via scoped `update` behaves correctly by construction.**
   `update(wishlist, QueryScope.user(b))` where `wishlist.user === a` matches on the *old*
   row's user (`b`), finds nothing, and returns `None`. A transfer only succeeds when the
   caller scopes to the current owner, which is the right rule.
7. **`insert` takes no scope.** There is nothing to narrow. Nothing prevents inserting a
   Wishlist bearing another user's id — see Out of Scope.

## Testing Decisions

1. **Behavioural specs per scoped repository**, matching the existing integration style
   (real libSQL via `createTestDatabase`, one repository per spec file). For each of
   `find`, `update` and `delete` on each of the three scoped repositories: in scope →
   `Some`/applied; owned by a different user → `None`/no rows touched; missing id →
   `None`. The out-of-scope `update`/`delete` cases assert the row is *unchanged*, not
   merely that the call returned `None`.
2. **Type-level spec** — `query-scope.spec.ts`, using `expectTypeOf` and `@ts-expect-error`
   (both already used in `libs/common/result` and `libs/domain`, and spec files are
   typechecked via `tsconfig.spec.json`):
   - `wishlists.find(id)` — rejected, scope is required.
   - `vendors.find(id, QueryScope.user(u))` — rejected, no `user` column.
   - `wishlists.find(id, QueryScope.all())` — accepted.
   - `vendors.find(id)` — accepted.

   This is the only test that can see slice 2's central promise. A variance regression
   leaves every behavioural test passing.
3. **Slice 1 needs no new tests**, only rewritten assertions — the `notFound` cases become
   `None` cases.

## Out of Scope

- **Transitive ownership.** "Is this *Item* mine" is `items ⋈ wishlists.user = ?`, a join,
  and no single-column scope expresses it. Services that need it do two reads. The
  `condition` seam is where a join-emitting scope would later plug in without touching
  call sites.
- **`QueryScope.item(...)` and plural consolidation.** A `findAll(scope)` replacing
  `findByUser`, `findByItem` (×3), `findByWishlist` and `findByCoupon` is where an
  item-valued scope would pay for itself. Until then those six methods are self-documenting
  at their call sites and cost nothing, and `findByVendorDomain` isn't a scope anyway, so
  the consolidation would be partial.
- **403 versus 404.** Deliberately collapsed. Callers cannot distinguish missing from
  out-of-scope, and nothing downstream can reconstruct the difference.
- **Scoping `insert`.** A caller can persist an entity bearing another user's id. This is
  the "no active protection" stance, stated as a consequence rather than treated as a gap.
- **Reservation token scoping.** Reservations are claimed by anonymous actors holding a
  token (ADR-0015), not by Users. `QueryScope.user` doesn't apply, and a token-valued scope
  isn't introduced here.
- **Ambient actor.** No request-scoped provider, no `AsyncLocalStorage`. The scope is an
  argument, visible at every call site.

## Further Notes

- Two ADRs come out of this: **ADR-0028** (absence is `Option`, not a failure — amends
  ADR-0018's failure vocabulary) and **ADR-0029** (caller-supplied `QueryScope`;
  repositories never enforce ownership — amends ADR-0021's capability interfaces).
- **`CONTEXT.md` is unchanged.** `QueryScope` is machinery, and the glossary stays free of
  implementation detail. "Owner" is already present implicitly, in Wishlist, Category and
  Coupon each belonging to one User.
- `UserRepository` is not scopable — the `users` table has an `id`, not a `user` column, so
  `QueryScope.user` correctly won't typecheck against it. Reading one's own User record is
  `find(id)`.

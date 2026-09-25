# Caller-supplied `QueryScope`; repositories never enforce ownership

> **Amended by ADR-0030.** 403 and 404 are distinguishable again on the authorize path: a
> caller loading an owned entity *in order to authorize it* reads with `QueryScope.all()`
> and `Authorization.authorize` decides, so absence (`not-found`) and denial (`forbidden`)
> are separate answers. `QueryScope.user` keeps its job for collection reads, where
> narrowing is subsetting rather than authorization.

Wishlists, Categories and Coupons each belong to one User, and almost every read or write
against them should be narrowed to the acting User. The first attempt at this —
`findForUser(user, id)` on `WishlistRepository` and `CategoryRepository`, behind a
`ReadableForUser` capability — scaled by method name rather than by argument: every owned
repository × every operation wanted a `ForUser` twin, mutations had no equivalent at all,
and the name fixed *who* the narrowing was for rather than *what* it was.

**Narrowing is an argument, not a method, and not a policy. `QueryScope<TTable>` is a
`WHERE` fragment the caller constructs and hands to the repository, which applies it
verbatim. Repositories never refuse anything and never compare a row's owner against an
actor.**

```ts
export interface QueryScope<TTable extends RepositoryTable> {
  readonly condition: (table: TTable) => SQL | undefined;
}

this.wishlists.find(id, QueryScope.user(actor));    // narrowed
this.wishlists.find(id, QueryScope.all());          // deliberately not, and it says so
```

A row excluded by the scope is indistinguishable from a row that doesn't exist — both are
`None` (ADR-0028). There is no "exists but not yours" signal anywhere in the stack. A
caller that wants to call it *not yours* does so in its own vocabulary, at its own layer.

The scope argument is **required** on scoped repositories — there is no default. That is
the one place this design is not permissive: the repository still refuses nothing, but a
caller cannot *silently* forget to narrow. `wishlists.find(id)` is a compile error, and
opting out is spelled `QueryScope.all()`, which a reviewer can grep for.

Gating comes from the type parameter, not from discipline. `QueryScope.user(u)` is a
`QueryScope<UserOwnedTable>` where `UserOwnedTable = RepositoryTable & { user: SQLiteColumn }`.
Under `strict` (hence `strictFunctionTypes`) the `condition` parameter is contravariant, so
`vendors.find(id, QueryScope.user(u))` fails to typecheck against a table with no `user`
column, while `QueryScope.all(): QueryScope<RepositoryTable>` flows into every repository.
This only holds because `condition` is a property with a function type — TypeScript's
method shorthand is bivariant even under `strict`, and writing it that way would erase the
guarantee with no other symptom.

## Considered options

- **A `ForUser` method per operation (rejected — the status quo).** Nine methods across
  three repositories to express one `and(...)` clause, and the count multiplies with every
  new owned entity. Reads only; nothing narrowed an `UPDATE` or `DELETE`, so a safe update
  meant read-then-write.
- **Repository-enforced ownership from a request-scoped actor (rejected).** The repository
  reads the current actor from DI and refuses foreign rows itself. Genuinely safer by
  default, but it makes every repository call depend on ambient request state — untestable
  without a request context, unusable from a background job or a CLI, and it puts an
  authorization decision in the layer that knows least about why the query is being run.
  Not ruled out forever; it would be the answer if "forgot to scope" ever becomes a real
  incident rather than a hypothetical.
- **`AsyncLocalStorage` actor (rejected).** Same trade as above, minus the DI, plus
  invisible control flow.
- **A failing scope — `QueryScope.must(user)` (rejected).** The original sketch: a scope
  that errs when the row is out of scope. Its failure would land in the `DatabaseFailure`
  channel, which every service maps wholesale to `unexpected` — so a caller wanting *not
  yours* would have to pattern-match the tag back out. That is strictly more work than the
  `Option.okOr` it replaced, and `Option.okOr` already *is* `must`, at the seam where the
  caller knows the right words.
- **A value-based scope living in `libs/domain`** (`{ column: 'user', value: Id }`, resolved
  by the repository) (rejected). Keeps Drizzle out of the scope type, but the repository
  then needs a total `match` over every scope kind, gating degrades to a string-literal
  generic with no natural variance, and the value is translated back into a `WHERE`
  fragment immediately anyway.
- **Caller-supplied `QueryScope` as an argument (chosen).** The narrowing is visible at
  every call site, needs no ambient state, works identically from a request handler and a
  cron job, and the `condition` seam is where a future join-emitting scope plugs in without
  touching callers.

## Consequences

- This amends ADR-0021. Capability interfaces gain scoped twins — `ScopedReadable<TEntity,
  TTable>`, `ScopedUpdatable`, `ScopedDeletable` — and the table type appears in the
  interface. A repository implements one side or the other, never both: implementing
  `Readable` alongside `ScopedReadable` would restore the one-argument `find` and make the
  required argument optional in practice.
- The table generic defaults to `RepositoryTable`, so the eight unscoped repositories
  (`users`, `vendors`, `extractions`, `items`, `tracked_items`, `price_history`,
  `reservations`, `coupon_rules`) are untouched.
- `findForUser`, `ReadableForUser` and the `findForUser` free function are deleted.
- 403 and 404 are collapsed permanently. Nothing downstream can reconstruct the difference,
  so a future "you may not do that" response needs this decision revisited, not merely
  extended.
- `insert` takes no scope. Nothing prevents persisting an entity bearing another user's id.
  That is the stance, stated as a consequence rather than treated as a gap.
- Transitive ownership — "is this *Item* mine", which is `items ⋈ wishlists.user = ?` — is
  not expressible as a single-column scope. Services that need it perform two reads. The
  `condition` seam accepts a join-emitting implementation later without a call-site change.
- Reservations are claimed by anonymous token holders (ADR-0015), not by Users, so
  `QueryScope.user` does not apply to them and no token-valued scope is introduced.
- The variance guarantee is load-bearing and invisible to behavioural tests: a
  method-shorthand slip or a widened table type leaves every runtime test green. It is
  pinned by `@ts-expect-error` assertions in `query-scope.spec.ts`, which fail in the
  direction that matters — when the error stops happening.

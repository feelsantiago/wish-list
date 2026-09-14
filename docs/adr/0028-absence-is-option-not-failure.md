# Absence is `Option`, not a failure — `DatabaseFailure` has no `not-found`

Singular reads in `libs/database` reported a missing row through the failure channel:
`find(id)` returned `AsyncResult<TEntity, DatabaseFailure>` and erred with
`DatabaseFailure.notFound(id)`. `VendorRepository.findByVendorDomain` and
`ExtractionRepository.findLatestByKey` did the same by hand, each constructing
`Failure.create('not-found', 'Entity not found', …)` inline — which CLAUDE.md forbids
outright. `findForUser`, added later, disagreed: it returned `Option<TEntity>`, so the two
read paths of the same repository meant different things by "not there".

**A row that isn't there is an answer, not a failure. Every read returns
`AsyncResult<Option<TEntity>, DatabaseFailure>`, and `DatabaseFailureType` is
`'constraint' | 'query' | 'mapping'` — three things that are genuinely the database's
fault.**

```ts
// yes
find(id: Id): AsyncResult<Option<Wishlist>, DatabaseFailure>;
// caller decides what absence means, in its own vocabulary
.andThen((found) => found.okOr(ServiceFailure.notFound(`wishlist:${id}`)))

// no
find(id: Id): AsyncResult<Wishlist, DatabaseFailure>;  // errs 'not-found'
```

`Some` is found. `None` is absent. `Err` is a query that couldn't run, a constraint that
was violated, or a row that wouldn't map. A row that fails validation stays
`err(DatabaseFailure.mapping(...))` — that really is a failure, and it is not the same
event as absence.

## Considered options

- **Err with a `'not-found'` tag (rejected — the status quo).** The convention nearly every
  repository layer reaches for, and it survives exactly as long as nobody wants to act on
  it. Services map the whole `DatabaseFailure` channel wholesale — `ItemService` does
  `.mapErr(ServiceFailure.unexpected)` — so a caller that wants *not found* semantics must
  `match` on the tag to fish one member back out of a union it has otherwise decided is an
  internal error, then re-tag it. The information round-trips through the wrong channel to
  arrive where `Option` would have put it directly.
- **Return `TEntity | undefined` (rejected).** CLAUDE.md bans bare `null`/`undefined` for
  absent values, and `Option` is already the workspace's answer (`@wish-list/common-result`).
- **Keep both — `find` errs, `findForUser` returns `Option` (rejected).** This was the state
  after the `findForUser` commit. Two methods on one repository, disagreeing about what a
  missing row is, with no rule for which future methods follow which.
- **`Option` for absence, `Err` for database faults (chosen).** One meaning per channel.
  It also matches what plural reads already did: `findByUser` returns `[]` for no matches,
  never an error.

## Consequences

- `DatabaseFailure.notFound` is deleted, and with it `DomainMapper`'s
  `domain(row: TRow | undefined, notFound: DatabaseFailure)` overload — that overload existed
  only to convert a missing row into an `Err`. The four mapper implementations forwarding to
  it (`coupon`, `coupon-rule`, `item`, `extraction`) shed a branch each.
- This amends ADR-0018. The database-layer failure vocabulary no longer includes absence;
  the translation boundary itself is unchanged.
- `VendorResolver.ensure` loses its `.orElse(match(error.name).with('not-found', …))` dance
  for a plain `Option` branch. Its race-recovery re-find in `provision` keeps a failure —
  a `None` immediately after a constraint violation is genuinely impossible, so it maps to
  `ExtractionFailure.persistFailed`.
- The migration cost was near zero only because no service called `find` yet — the sole
  production caller of any singular read was `VendorResolver`. Landing this after more
  `service` libs exist would have been materially more expensive.
- Callers must now say what absence means to them. `ItemService.checkExists` already did
  (`found.okOr(ServiceFailure.notFound(resource))`); every future service writes the same
  one line rather than inheriting a word the database layer chose for it.

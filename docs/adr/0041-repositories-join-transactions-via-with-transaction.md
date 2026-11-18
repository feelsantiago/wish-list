# Repositories join a transaction through `withTransaction(tx)`

`Database.transaction(db, tx => …)` (PRD-0010) hands its callback a `tx`, but every
repository holds the `db` it was constructed with inside `RepositoryOptions`
(`{ db, table, mapper }`, ADR-0021). Nothing inside the callback can reach a repository
that writes through `tx`. The only transactional code so far is a spec that writes raw
`tx.insert(users)`. ADR-0032's first sign-in, which creates a `User` and its Unsorted
Category together, is the first real case, and it would have to bypass the repositories.

**A repository that takes part in transactions implements a `Transactional<TSelf>`
capability: `withTransaction(tx): TSelf` returns a new instance of the same repository
whose `options.db` is `tx`. `table` and `mapper` carry over unchanged.**

```ts
Database.transaction(db, (tx) =>
  users.withTransaction(tx).insert(user)
    .andThen(() => categories.withTransaction(tx).insert(unsorted)),
);
```

`RepositoryOptions.db` widens from `LibSQLDatabase` to the type both the database and a
transaction satisfy, so the free functions in `operation.ts` work unchanged against either.

## Considered options

- **The service writes rows with `tx` directly** (rejected). No change to `libs/database`,
  but it skips the mappers, duplicates what `insert` already does, and puts table
  knowledge in a service lib, which breaks the repository seam (ADR-0016).
- **Pass `tx` as an optional argument to every operation** (rejected). Every method
  signature on every repository grows a parameter that most callers never use.
- **Ambient transaction via `AsyncLocalStorage`** (rejected). Repositories pick up the
  current `tx` implicitly. No signature changes, but whether a write is inside a
  transaction becomes invisible at the call site, and it is machinery out of proportion
  to one use case.
- **`withTransaction(tx)` returning a bound copy (chosen).** Only `options.db` changes,
  the call site says which writes share the transaction, and it follows ADR-0021's
  pattern of a capability declared on the class.

## Consequences

- `Transactional<TSelf>` joins the capability interfaces in `repository/capability.ts`.
  It is added only to repositories that a transaction actually uses. For M0 that is
  `UserRepository` and `CategoryRepository`; others gain it when a use case needs it.
- `withTransaction` constructs the repository directly (`new UserRepository(tx, mapper)`)
  rather than through Nest DI. The bound copy is short-lived and never registered.
- The rollback trigger stays as it is: `Database.transaction` rolls back when the
  callback's promise rejects, so a callback that composes `AsyncResult`s must turn an
  `Err` into a rejection inside the callback. The exact shape is settled while building
  M0 step 3, with a spec proving that a failed second write leaves no first row behind.
- ADR-0021 and ADR-0016 are extended, not replaced. Services still import concrete
  repositories.

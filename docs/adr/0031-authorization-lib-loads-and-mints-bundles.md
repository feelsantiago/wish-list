# A horizontal `libs/authorization` loads owned entities and mints the bundle

ADR-0030 established that a service receives `UserAuthorized<T>` as proof of Ownership and
performs no check itself — "the caller loads the entities, authorizes them together, and
hands the proof to the service." It never named the caller, because `apps/api` did not
exist yet.

Naming it now shows that no legal caller existed. ADR-0004 forbids `apps/api` from
touching `libs/database`, and forbids a `service` lib from importing another `service`
lib. A controller therefore cannot load the `Wishlist` and `Category` it needs to
authorize, and no other service is allowed to load them on its behalf.

**Ownership loading moves into a new horizontal lib, `libs/authorization`, sitting at the
same tier as `libs/extraction`.** It depends on `libs/domain` and `libs/database`, wraps
the pure `Authorization` class rather than replacing it, loads each named member by id
with `QueryScope.all()`, and returns the branded bundle.

```ts
// libs/authorization
class EntityAuthorizer {
  authorize<K extends OwnedKey>(
    user: User,
    members: Record<K, Id>,
  ): AsyncResult<UserAuthorized<OwnedEntities<K>>, AuthorizationFailure>;
}

// apps/api — a controller
const authorized =
  yield *
  this.authorizer.authorize(user, {
    wishlist: params.wishlistId,
    category: body.categoryId,
  });
return this.items.create({ authorized, url: body.url });
```

ADR-0030 pre-authorized this move: `Authorization` stays in `libs/domain` "until
authorization must consult something that is not an entity field — a Plan, a Sharing
token, a repository." Loading is that moment. The split is deliberate: `libs/domain` keeps
the rule (compare `entity.user` to `user.id`, reject a Deactivated actor), and
`libs/authorization` keeps the IO (fetch the rows the rule runs on).

## Considered options

- **Controllers in `apps/api` load and authorize** (rejected). The direct reading of
  ADR-0030's "caller". Requires amending ADR-0004 to let the app inject repositories,
  which erases the reason the service seam exists — once the app holds a repository,
  nothing stops it from holding all of them and writing queries beside the services.
- **A `@Authorized(...)` param decorator** (rejected). The same violation with better
  ergonomics, plus IO inside a parameter decorator, which is the hardest place in Nest to
  test and the easiest place to accidentally make N sequential round trips.
- **Each owning service authorizes at its own entry** (rejected). A public
  `create(user, { wishlistId, categoryId, url })` loads and authorizes, then delegates to a
  private method taking the bundle. Preserves every ADR-0004 rule and needs no new lib —
  but the brand degrades to an intra-class convention (the only caller of the private
  method is three lines above it), and load-plus-authorize is rewritten in every service
  that touches an owned entity. Rejected on duplication, not on correctness; this is the
  fallback if the registry below proves unwieldy.
- **A horizontal `libs/authorization`** (chosen). Every ADR-0004 rule stays true —
  `apps/api` holds no repository, no service imports a service — and the load-and-authorize
  step is written once.

## Consequences

- **ADR-0004's dependency graph gains a node.** `apps/api → libs/authorization →
libs/domain, libs/database`, alongside `libs/extraction`. A `service` lib does _not_
  depend on it: services receive the bundle, they never mint one.
- **The lib holds a registry** mapping member key to repository — `wishlist`, `category`,
  `coupon`, `coupon-rule`, `tracked-item`. It is the one place that enumerates every owned
  entity, and it grows by one line per slice. This is the cost of the choice; an entity
  missing from the registry is a compile error at the call site, not a silent bypass.
- **The 403/404 distinction of ADR-0030 is preserved**, because the lib loads with
  `QueryScope.all()`: a missing row is `not-found`, a foreign row is `forbidden`. Collection
  reads keep using `QueryScope.user` and never go through this lib.
- **Transitive Item ownership lands here too.** ADR-0030 defers `authorizeVia(user,
{ item }, { wishlist })`; when it ships, the witness _loading_ belongs to this lib and the
  witness _check_ to `libs/domain`, on the same split as the rest.
- **One extra round trip per authorized member.** Loading is per-id; a bundle of two is two
  reads. Acceptable at this scale, and batching stays a private optimisation of the lib
  because the signature takes the whole bundle at once.
- `Authorization` in `libs/domain` is untouched, stays pure and synchronous, and remains
  usable from a seed script or a test with no database.

# `UserAuthorized` bundles; services receive proof of Ownership, never check it

`ItemService.create` took a `User`, a `Wishlist` and a `Category` and compared
`wishlist.user === user.id` and `category.user === user.id` itself. Nothing in the
signature said it had to, so every future service that touches an owned entity has to
remember the same two comparisons, and forgetting one is invisible to the type checker
and to every behavioural test.

**Ownership is checked in one place — `Authorization.authorize` in `libs/domain` — which
returns a branded bundle. A service that needs owned entities declares `UserAuthorized<…>`
in its input type and performs no ownership check at all.**

```ts
type UserOwned = { readonly id: Id; readonly user: Id };
type UserAuthorized<T> = T & Brand<T, `authorized:${keyof T & string}`>;

class Authorization {
  constructor(user: User);
  authorize<T extends Record<string, UserOwned>>(
    data: T,
  ): Result<UserAuthorized<T>, AuthorizationFailure>;
}

type CreateItemInput = {
  authorized: UserAuthorized<{ wishlist: Wishlist; category: Category }>;
  url: Url;
};
```

**The brand is on the bundle, not on the entity.** A per-entity `UserAuthorized<Wishlist>`
only proves *some* user owns it, so a wishlist authorized for A and a category authorized
for B both satisfy a two-field signature and the item lands in A's wishlist under B's
category — the exact bug this replaces, re-expressed as valid code. Authorizing the
members together against one actor is what makes same-owner coherence a property of the
type rather than of the caller's discipline. This is also why `authorize` has no
single-entity overload: the overload resolves cleanly (`Wishlist` fails
`Record<string, UserOwned>`; `{ wishlist: Wishlist }` fails `UserOwned`), but its return
type would reintroduce the per-entity brand as a spellable type. One entity is spelled
`authorize({ wishlist })`.

**The actor is bound at construction** — `new Authorization(user).authorize(data)` — so one
`Authorization` serves an actor across as many bundles as a request needs, and `authorize`
takes only what is being proved. `UserOwned` carries `id` alongside `user` because the
failure names every member it rejected, by key and by id.

**The tag carries the bundle's key set** (`` `authorized:${keyof T & string}` ``) rather
than a constant. With a constant tag, `{ ...authorizedWishlist, ...authorizedCategory }`
type-checks as a combined bundle, because spread copies the phantom property verbatim.
Keying the tag makes the spread's tag object the right operand's alone, so the merged
value is missing the other key and the assignment fails.

**What the brand does not survive:** `{ ...authorized, wishlist: someoneElsesWishlist }`
type-checks. No intersection brand can prevent it — spread copies the phantom property as
a sibling. The brand stops accidents, not a deliberate forge, and sits at the same trust
tier as an `as` cast (ADR-0006). Both forge paths are pinned by `@ts-expect-error`
assertions rather than left to review.

## Considered options

- **Phantom user parameter** (`UserAuthorized<T, U>`, tagged with the actor) (rejected).
  Would make coherence checkable per entity, but requires a distinct *type* per user.
  Every `Id` is the same type at runtime, and TypeScript has no rank-2 polymorphism to
  mint a fresh one per scope. Not implementable.
- **Per-entity brand plus the service still comparing ids** (rejected). The brand becomes
  documentation and the runtime check stays. Nothing is gained.
- **Repository mints the brand on scoped reads** — `find(id, QueryScope.user(u))` returns
  `Option<UserScoped<Wishlist>>` (rejected). Probed and it works: ADR-0029's variance
  gating survives, and the conditional return fires when written against the scope's
  inferred *kind* rather than against `QueryScope<…>` (checking the full scope type fails,
  because the contravariance that makes the gate work also blocks the `extends`). Rejected
  on meaning, not mechanics: `QueryScope.user` says *which rows*, not *whose* — narrowing
  is repository vocabulary for a subset of the data, and labelling its result "authorized"
  puts an authorization word in the layer ADR-0029 deliberately stripped of one. It also
  cannot replace `authorize`, since a repository fetches one entity and can therefore only
  ever mint the per-entity brand rejected above. Cost, had it been adopted: a generic
  parameter on every method of `ScopedReadable`/`ScopedUpdatable`/`ScopedDeletable`, one
  `as` per method per scoped repository (~12 sites, since an implementation cannot prove
  its own conditional return), and a second invisible type-level guarantee interacting with
  the first inside `QueryScope`.
- **`authorize` loads the entities itself** (rejected). Collapses fetch and check into one
  seam, but the authorization lib then depends on every owned repository, and it re-fetches
  what the caller already holds. Callers load; `authorize` decides.
- **Whole-input bundle**, with non-owned members like `Url` passing through (rejected).
  Requires relaxing the constraint to `Record<string, unknown>`, at which point it stops
  catching anything. Non-owned values stay outside the brand as ordinary fields.
- **A new horizontal `libs/authorization`** (rejected for now). `authorize` is pure field
  comparison over domain entities, so it is a business rule and lives in `libs/domain`
  alongside the non-entity folders already there (`brand/`, `plain/`). It moves out the
  moment authorization must consult something that is not an entity field — a `Plan`, a
  Sharing token, a repository.

## Consequences

- **This amends ADR-0029's "403 and 404 are collapsed permanently."** That ADR invited the
  revisit and this is it. A caller loading an owned entity *in order to authorize it* uses
  `QueryScope.all()`, so absence (`None` → `not-found`) and denial (`authorize` →
  `forbidden`) are distinguishable again. A 403 confirms the row exists; acceptable because
  ids are opaque UUIDs. `QueryScope.user` keeps its job for collection reads — listing *my*
  wishlists is subsetting, not authorization.
- The inverse risk is accepted knowingly: an unscoped read followed by a forgotten
  `authorize` holds another user's row in memory. It cannot reach a mutation, because the
  service's input type demands the brand — "forgot to authorize" is a compile error at the
  only place it matters. Read-only paths that never authorize keep using `QueryScope.user`.
- `authorize` also rejects a Deactivated `User` (`AuthorizationFailure` is
  `Failure<'forbidden' | 'user-deactivated'>`), so it takes a `User`, not an `ActiveUser`
  or an `Id`. This is deliberately not the session layer's job *yet* — `apps/api` does not
  exist. When a session guard appears, the status check belongs there and this becomes
  defense in depth.
- `libs/domain` does not import `@wish-list/common-error/service`. `AuthorizationFailure`
  is a plain `Failure<…>`, assignable into a service channel by covariance. Services that
  authorize declare `ServiceFailure<'user-deactivated'>` — the same widening
  `ExtractionFailure` already uses — rather than mapping the tag away. A Deactivated user
  gets a different answer than an ownership denial, all the way to the edge.
- All failing members of a bundle are reported, not the first.
- The brand stops at the service boundary. `Item.create` still takes trusted `Id`s, so
  ADR-0014's precedent is untouched: the bundle is a service-layer proof, unwrapped at the
  same seam every other FK already crosses. Domain `create` functions stay callable from a
  seed script that has no `User`.
- Plan gating stays out of `authorize`. `ProUser` narrowing is per-feature (ADR-0012);
  folding it in would make `authorize` the sink every gate accretes into.
- Transitive Ownership — "is this *Item* mine" — is deferred, not solved. `Item` has no
  `user` field, so it cannot enter a bundle at all. Services needing it load the Item's
  Wishlist and authorize that. When the first Item mutation ships, the intended shape is a
  witness form (`authorizeVia(user, { item }, { wishlist })`) checking both links in one
  place — explicitly *not* a denormalized `Item.user`, which would create a second source
  of truth that disagrees after a future move-between-wishlists.
- `ItemService` stops importing `User`, `Wishlist`, `Category` and
  `ServiceFailure.forbidden` entirely. Its remaining failure surface is `unexpected` from
  the extractor and the repository.

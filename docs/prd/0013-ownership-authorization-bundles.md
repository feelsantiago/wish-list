## Problem Statement

`ItemService.create` decides ownership itself:

```ts
yield* this.authorizeWishlist(input.user, input.wishlist);
yield* this.authorizeCategory(input.user, input.category);
```

Two private methods, each comparing `entity.user === user.id`, each minting
`ServiceFailure.forbidden`. The problems compound:

- **The signature promises nothing.** `CreateItemInput` is `{ user, wishlist, category, url }`
  — four unrelated values. Nothing about the type says the Wishlist and the Category must
  belong to that User. The rule lives only in the method body, so the next service that
  touches an owned entity must remember to write the same two comparisons, and forgetting
  one is invisible to the type checker and to every behavioural test.
- **The service is the wrong place for it.** `ItemService` exists to reconcile an
  extraction into an Item. Ownership is a fact about `Wishlist` and `Category`, not about
  items, and `ItemService` imports `User`, `Wishlist`, `Category` and
  `ServiceFailure.forbidden` for no other reason.
- **It does not scale.** Ownership applies to Wishlist, Category and Coupon, across create,
  update, delete and every future mutation. Per-service ownership checks means the same
  comparison rewritten at every call site forever, with the failure mode being silence.

`CONTEXT.md` had no word for the relation being checked — Wishlist *"belonging to one
User"*, Category *"global to the User"* and Coupon *"a discount code a User stores"* each
describe it separately, and none names it.

## Solution

**Ownership is checked in one place and the result is a branded bundle. A service that
needs owned entities declares the brand in its input type and performs no check at all.**

```ts
// libs/domain/src/lib/authorization/
type UserOwned = { readonly id: Id; readonly user: Id };
type UserAuthorized<T> = T & Brand<T, `authorized:${keyof T & string}`>;

class Authorization {
  constructor(user: User);
  authorize<T extends Record<string, UserOwned>>(
    data: T,
  ): Result<UserAuthorized<T>, AuthorizationFailure>;
}
```

The actor is bound at construction, not passed per call: one `Authorization` serves an
actor across as many bundles as that request needs, and `authorize` takes only what is
being proved. `UserOwned` carries `id` as well as `user` because the failure names every
member it rejected, by key and by id.

The caller loads the entities, authorizes them together, and hands the proof to the
service:

```ts
const authorized = yield* new Authorization(user).authorize({ wishlist, category });
yield* this.items.create({ authorized, url });
```

```ts
export type CreateItemInput = {
  authorized: UserAuthorized<{ wishlist: Wishlist; category: Category }>;
  url: Url;
};
```

`user` leaves `CreateItemInput` entirely — the service had no other use for it, and the
bundle *is* the user's presence.

### Why the bundle, and not the entity

A per-entity `UserAuthorized<Wishlist>` proves only that *some* User owns it. Two of them
satisfy a two-field signature:

```ts
type CreateItemInput = {
  wishlist: UserAuthorized<Wishlist>;   // authorized for user A
  category: UserAuthorized<Category>;   // authorized for user B
};                                      // typechecks. Item lands in A's wishlist under B's category.
```

That is the bug this PRD removes, re-expressed as valid code. Authorizing the members
*together* against one actor makes same-owner coherence a property of the type rather than
of the caller's discipline. Tagging the brand with the actor instead (`UserAuthorized<T, U>`)
was considered and is not implementable — every `Id` is the same type, and TypeScript has
no rank-2 polymorphism to mint a distinct one per actor.

### Why the tag carries the key set

With a constant tag, two separately-authorized bundles merge:

```ts
const forged: UserAuthorized<{ wishlist: Wishlist; category: Category }> =
  { ...authorizedWishlist, ...authorizedCategory };   // typechecks with a constant tag
```

Spread copies the phantom property verbatim, and both operands carry an identical one.
Keying the tag by `keyof T` means the spread result's tag object is the right operand's
alone, so the merged value is missing `authorized:wishlist` and the assignment fails. Both
behaviours were verified against the workspace's TypeScript before this was written.

### What it does not stop

```ts
const forged: Target = { ...authorized, wishlist: someoneElsesWishlist };  // typechecks
```

No intersection brand can prevent this — spread copies the phantom property as a sibling.
The brand stops accidents, not a deliberate forge, and sits at the same trust tier as an
`as` cast (ADR-0006). Both forge paths are pinned by type-level assertions rather than left
to review.

### Failure

```ts
// libs/domain/src/lib/authorization/authorization-failure.ts
export type AuthorizationFailureType = 'forbidden' | 'user-deactivated';
export type AuthorizationFailure = Failure<AuthorizationFailureType>;

export namespace AuthorizationFailure {
  export function notOwned(
    actor: Id,
    entities: ReadonlyArray<{ readonly key: string; readonly id: Id }>,
  ): Failure<'forbidden'>;

  export function userDeactivated(actor: Id): Failure<'user-deactivated'>;
}
```

`notOwned` reports **every** failing member, not the first — the comparison runs over all
of them anyway, and a first-only failure turns a one-request answer into a two-request
debugging loop.

`libs/domain` does not import `@wish-list/common-error/service`. `Failure<T>` is covariant
in its tag, so `AuthorizationFailure` flows into a service channel with no `mapErr`:
`'forbidden'` is already in `ServiceFailureType`, and `'user-deactivated'` is carried by
widening the return type of whichever service *authorizes* — the same mechanism
`ExtractionFailure = ServiceFailure<ExtractionFailureType>` already uses:

```ts
// the authorizing caller, not ItemService.create — after slice 2 ItemService never
// authorizes, so it cannot emit 'user-deactivated' and keeps a bare ServiceFailure.
public add(input: AddItemInput): AsyncResult<Item, ServiceFailure<'user-deactivated'>>
```

### How callers load

Owned entities loaded *in order to authorize them* are read with `QueryScope.all()`, and
`authorize` decides. `QueryScope.user` is repository vocabulary for *which rows*, not
*whose* — it keeps its job for collection reads (listing one's own Wishlists is
subsetting, not authorization). This amends ADR-0029's "403 and 404 are collapsed
permanently"; that ADR invited the revisit and this is it.

## Slices

Two commits, landing in order. Each is independently revertible.

### Slice 1 — the authorization primitives

No consumer changes. Stands on its own even if slice 2 were abandoned.

```
libs/domain/src/lib/authorization/
  user-owned.ts               type UserOwned
  user-authorized.ts          type UserAuthorized<T>
  authorization-failure.ts    type + namespace
  authorization.ts            class Authorization { authorize }
  authorization.spec.ts       behavioural
  user-authorized.spec.ts     type-level pins
```

- `authorize` checks `user.status === 'deactivated'` first and short-circuits, then
  compares every member's `user` against `user.id`, collecting all mismatches.
- Returns `Result`, not `AsyncResult` — it is pure field comparison, no IO.
- The brand is minted by a single `as` inside `authorize`, the only cast in the folder
  (ADR-0006's `from()`-cast precedent).
- `libs/domain/src/index.ts` exports `Authorization`, `AuthorizationFailure`, and the types
  `UserOwned`, `UserAuthorized`, `AuthorizationFailureType`.

### Slice 2 — `ItemService` consumes the proof

- `CreateItemInput` becomes `{ authorized, url }`.
- `authorizeWishlist` and `authorizeCategory` are **deleted**, and with them `ItemService`'s
  imports of `User`, `Wishlist`, `Category` and `ServiceFailure.forbidden`.
- `create` keeps `AsyncResult<Item, ServiceFailure>`. It no longer authorizes, so it cannot
  emit `'user-deactivated'`; that widening belongs to whichever future caller does.
- `reconcile` is unchanged — it already takes `{ wishlist: Id; category: Id }`, which the
  service reads off `input.authorized`.
- `item.service.spec.ts`: the two `returns forbidden when …` cases move to
  `authorization.spec.ts`; the fixtures build an authorized bundle instead of four loose
  values.

## Implementation Decisions

1. **No single-entity overload.** Overload resolution would be unambiguous — `Wishlist`
   fails `Record<string, UserOwned>` (its `name: string` is not `UserOwned`), and
   `{ wishlist: Wishlist }` fails `UserOwned` (no `user` property) — but the single form's
   *return type* would reintroduce the per-entity brand as a spellable type, manufacturing
   the vocabulary for the exact bug this PRD removes. One entity is spelled
   `authorize(user, { wishlist })`.
2. **Non-owned values stay outside the bundle.** `Url` has no `user` field and so cannot
   enter; it remains an ordinary field on `CreateItemInput`. Widening the constraint to
   admit it would stop it catching anything.
3. **`authorize` takes `User`, not `ActiveUser` or `Id`.** An `Id` argument accepts any id
   as the actor, silently, in the one function whose purpose is preventing id confusion.
   `ActiveUser` would move the status check to the type level (ADR-0012's idiom) but
   requires a session boundary to narrow at, and `apps/api` does not exist yet. When a
   session guard appears, the status check belongs there and this becomes defense in depth.
4. **`authorize` never loads anything.** Callers load. Giving it repositories would make
   the authorization layer depend on every owned repository and re-fetch what the caller
   already holds.
5. **Repositories do not mint the brand.** `find(id, QueryScope.user(u))` returning
   `Option<UserScoped<Wishlist>>` was probed and works mechanically — ADR-0029's variance
   gating survives, and the conditional return fires when written against the scope's
   inferred *kind*. Rejected on meaning: narrowing is not authorization. It also cannot
   replace `authorize`, since a repository fetches one entity and can only ever mint the
   per-entity brand rejected above.
6. **The brand stops at the service boundary.** `Item.create` still takes trusted `Id`s.
   ADR-0014's precedent — cross-entity FKs pass as already-trusted `Id`, domain `create`
   never takes a whole related entity — is untouched, and `Item.create` stays callable from
   a seed script that has no `User`.
7. **Plan gating stays out.** `ProUser` narrowing is per-feature (ADR-0012). Folding it in
   would make `authorize` the sink every gate accretes into.
8. **`libs/domain`, not a new horizontal lib.** `authorize` is pure field comparison over
   domain entities, so it is a business rule, and non-entity folders (`brand/`, `plain/`)
   already live there. It moves to its own lib the moment authorization must consult
   something that is not an entity field — a `Plan`, a Sharing token, a repository.

## Testing Decisions

1. **Behavioural** — `authorization.spec.ts`:
   - single-member bundle, owned → `Ok`, members readable and unchanged
   - multi-member bundle, all owned → `Ok`
   - one foreign member → `Err('forbidden')`, metadata names that member's key and id
   - both foreign → `Err('forbidden')`, metadata names **both**
   - Deactivated User owning every member → `Err('user-deactivated')`, and ownership is
     not reported (status short-circuits)
2. **Type-level** — `user-authorized.spec.ts`, using `expectTypeOf` and `@ts-expect-error`
   (both already used in `libs/common/result` and `libs/domain`; spec files are typechecked
   via `tsconfig.spec.json`):
   - a plain unbranded record is rejected where `UserAuthorized<…>` is required
   - `{ ...authorizedWishlist, ...authorizedCategory }` is rejected as a combined bundle —
     this is the assertion the key-carrying tag exists for, and it is the only test that
     can see it
   - a value with a non-`UserOwned` member (`{ url: Url }`) is rejected by `authorize`'s
     constraint
   - `{ ...authorized, wishlist: foreign }` is **accepted**, asserted positively with
     `toExtend` and a comment naming it as the known limit. If someone later closes
     this hole, the assertion fails and they find out why it was documented.
3. **Slice 2 adds no new `ItemService` tests** — the two forbidden cases move out, and the
   remaining extraction/reconciliation cases only change how their input is built.

The type-level spec is load-bearing in the same way ADR-0029's variance assertions are: a
regression in the tag shape leaves every behavioural test green.

## Out of Scope

- **Transitive ownership.** `Item` carries no `user` field and cannot enter a bundle at
  all. Services that need "is this Item mine" load the Item's Wishlist and authorize that.
  The intended shape when the first Item mutation ships is a witness form —
  `authorizeVia(user, { item }, { wishlist })`, checking both links in one place —
  explicitly *not* a denormalized `Item.user`, which would create a second source of truth
  that disagrees after a future move-between-wishlists.
- **Authentication and the session layer.** Nothing here loads a `User` or establishes who
  the actor is. `apps/api` does not exist.
- **Sharing-token authorization.** Reservations are held by anonymous token holders
  (ADR-0015), not owned by Users. `UserOwned` does not apply and no token-valued
  counterpart is introduced.
- **Plan gating.** Per-feature `FreeUser`/`ProUser` narrowing, unchanged (ADR-0012).
- **Collection reads.** Listing one's own Wishlists stays `all(QueryScope.user(u))` and
  never touches the authorization layer.
- **Retrofitting other services.** `ItemService` is the only consumer today; Wishlist,
  Category and Coupon services do not exist yet and will be written against this from the
  start.
- **Closing the member-override forge.** Not closeable with a structural brand, and
  deliberate. Documented, pinned, accepted.

## Further Notes

- **ADR-0030** records this decision, including the five rejected alternatives and the two
  probed forge paths.
- **`CONTEXT.md` gains `Ownership`** — the relation between a User and the Wishlists,
  Categories and Coupons they hold; no delegation, no admin actor; Item owned transitively;
  Reservation not owned at all. `Status (of a User)` is amended so a Deactivated User's
  refusal reads as distinct from an ownership denial.
- **This amends ADR-0029.** 403 and 404 are distinguishable again on the authorize path. A
  403 confirms the row exists, which is acceptable because ids are opaque UUIDs. The
  inverse risk is accepted knowingly: an unscoped read followed by a forgotten `authorize`
  holds a foreign row in memory, but it cannot reach a mutation, because the service's
  input type demands the brand.

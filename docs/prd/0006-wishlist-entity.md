## Problem Statement

`Item.wishlist: Id` (PRD-0005) references `Wishlist`, which doesn't exist yet. `CONTEXT.md` describes it as "a named, ownable collection of Items belonging to one User... shareable independently via its own link" — the share-link/Surprise Mode half of that belongs to the future `sharing` feature (ADR-0004); this PRD covers the core entity only.

## Solution

Add `Wishlist` to `libs/domain` (interface + namespace, ADR-0007): `id`, `user`, `name`, `createdAt`, `updatedAt` (ADR-0013 naming). Every User gets a default Wishlist ("My Wishlist") provisioned at signup, same eager-provisioning timing as Category's Unsorted (PRD-0004) — but unlike Unsorted, the default Wishlist carries no protection flag and is freely renameable/deletable.

## User Stories

1. As a developer, I want a `Wishlist` interface with `id: Id`, `user: Id`, `name: string`, `createdAt: Date`, `updatedAt: Date`.
2. As a developer, I want `Wishlist.create(input: { user: Id; name: string })` to treat `user` as an already-trusted `Id` (no re-validation, consistent with `Category.create`), validate `name` as non-empty, auto-generate `id`, and stamp `createdAt`/`updatedAt`, returning `Result<Wishlist, DomainFailure>`.
3. As a developer, I want no `isDefault` field and no separate `createDefault` factory — a User's default Wishlist ("My Wishlist") is provisioned by calling the same `Wishlist.create({ user, name: 'My Wishlist' })` an Account-signup service would call for any other Wishlist, since it needs no special protection.
4. As a developer, I want no name-uniqueness constraint on Wishlist — a User may have multiple Wishlists with the same name (unlike Category, `CONTEXT.md` doesn't call this out as a problem, and Wishlists are distinguished by `id`/their own share link regardless of name).
5. As a developer, I want `Wishlist.rename(wishlist: Wishlist, name: string): Result<Wishlist, DomainFailure>` — validates `name` non-empty, returns a new object with `updatedAt` refreshed, since the default Wishlist is freely editable and rename is the obvious near-term mutation.
6. As a developer, I want `Wishlist.from(plain)` (trusted reconstruction) and `Wishlist.plain(wishlist)` (produces `Plain<Wishlist>`), per ADR-0007/0009.

## Implementation Decisions

- **File location:** `libs/domain/src/lib/wishlist/wishlist.ts`, following the `Category` folder pattern.
- **Validation schema:** `z.object({ name: z.string().min(1) })` — `user` is `Id`-typed at the function boundary, not part of the `zod` schema, same treatment as `Category.create`.
- **`rename`** reuses the same `name` validation as `create` (both go through the same `z.string().min(1)` check) rather than duplicating a separate schema.
- **No deletion-safety guard in this PRD** — a User deleting their only Wishlist (default or not) with no replacement is a real edge case, but it's a service-layer/UX concern (e.g. blocking the delete action, or re-provisioning a default), not a domain-layer rule; noted in Out of Scope.

## Testing Decisions

- `Wishlist.create`: valid input produces a `Wishlist` with generated `id` and equal `createdAt`/`updatedAt`; empty `name` produces `DomainFailure`.
- `Wishlist.rename`: valid new name produces a new object with `updatedAt` refreshed and `id`/`user`/`createdAt` unchanged; empty name produces `DomainFailure`.
- Round-trip: `Wishlist.from(Wishlist.plain(wishlist))` deep-equals the original.
- Test runner: Vitest.

## Out of Scope

- Share-link generation, Surprise Mode field — future Sharing PRD (ADR-0004's `sharing` feature).
- Orchestrating default-Wishlist creation alongside `User.create`/`Category.createDefault` at signup — Account-feature service concern, not this PRD's domain-layer scope.
- Guarding against a User ending up with zero Wishlists (deleting the last one) — service-layer/UX concern, not specced here.
- Wishlist deletion itself — no `Wishlist.delete`-style domain function needed (deletion is a repository-layer operation, not a state transition on the entity).

## Further Notes

- Depends on PRD-0003 (`User`) and follows PRD-0004's `Category` as the closest reference implementation (same `create`/`rename` shape, same trusted-`user`-Id treatment, same "eager default at signup" timing minus the protection flag).
- `Item.wishlist` (PRD-0005) now resolves to a concrete entity.

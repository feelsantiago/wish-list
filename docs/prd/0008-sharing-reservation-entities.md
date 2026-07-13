## Problem Statement

`CONTEXT.md` describes Sharing (publishing a Wishlist at an unlisted link), Reservation (a Pro-only anonymous claim on an Item), and Surprise Mode (per-Wishlist control over whether the owner sees Reservations) — none of these exist in `libs/domain` yet. PRD-0006 explicitly deferred all three as the future `sharing` feature (ADR-0004). This PRD adds them: extending `Wishlist` with sharing/style fields, and introducing `Reservation` as a new entity.

## Solution

Extend `Wishlist` (`libs/domain/src/lib/wishlist/wishlist.ts`) with three fields, all decided during this PRD's grilling session:

- `slug: string` — an opaque, unguessable link identifier, generated eagerly by `Wishlist.create` (every Wishlist has one from the start, not lazily provisioned when the owner first shares).
- `published: boolean`, default `true` — gates whether the Wishlist is actually reachable by its `slug`. The `slug` existing doesn't imply visibility; `published` is the explicit owner-controlled toggle (grilling surfaced a real case: a private gift-tracking Wishlist the owner never intends to expose, even though every Wishlist gets a `slug`).
- `style: 'default' | 'surprise'`, default `'surprise'` — replaces a plain boolean per the grilling session's request to reuse ADR-0012's literal-field narrowing (`ProUser`/`FreeUser`) for `Wishlist`, giving `DefaultWishlist | SurpriseWishlist` as a compile-time-narrowable union the same way `Plan` does for `User`. Unlike `slug`/`published`, `style` is caller-supplied: an optional `CreateInput.style` field, defaulting to `'surprise'` via the `zod` schema when omitted. There is no `Wishlist.setStyle` — grilling concluded style is chosen once at creation and is immutable after, so no set-later mutator exists (or is needed by `DefaultWishlist | SurpriseWishlist`'s narrowing, since nothing currently converts one variant to the other post-creation).

New functions: `Wishlist.regenerateSlug` (issues a new `slug`, invalidating the old link, independent of `published` — an owner can rotate a leaked link without unpublishing) and `Wishlist.publish`/`Wishlist.unpublish` (toggle `published`). All follow `Wishlist.rename`'s existing shape: pure function, new object, `updatedAt` refreshed.

Add `Reservation` as a new entity (`libs/domain/src/lib/reservation/reservation.ts`, ADR-0007 interface + namespace pattern): an anonymous Sharing viewer's claim on an `Item`, with a `name` and a `token`. The `token` (ADR-0015) is this domain's first authorization mechanism for an actor that isn't a `User` — issued at `create`. Cancelling a Reservation (matching the token, deleting the record) is not a domain-level concept in this PRD; it's deferred to a future PRD as a service-layer operation (see Out of Scope).

## User Stories

### Wishlist extensions

1. As a developer, I want `Wishlist.create` to also produce `slug: string` (auto-generated, not caller-supplied) and `published: boolean` (defaults `true`, not part of `CreateInput`) — neither is a caller input at creation time, matching `id`/`createdAt`/`updatedAt`'s existing auto-stamped treatment. `style: 'default' | 'surprise'` is the exception: an optional `CreateInput.style`, defaulting to `'surprise'` when omitted.
2. As a developer, I want `Wishlist = DefaultWishlist | SurpriseWishlist`, narrowed on the `style` field per ADR-0012's precedent (`DefaultWishlist = Wishlist & { style: 'default' }`, `SurpriseWishlist = Wishlist & { style: 'surprise' }`), so a future owner-view function can require a specific variant in its signature.
3. As a developer, I want `Wishlist.regenerateSlug(wishlist: Wishlist): Wishlist` — produces a new object with a freshly generated `slug` and refreshed `updatedAt`; `published`/`style` untouched.
4. As a developer, I want `Wishlist.publish(wishlist: Wishlist): Wishlist` and `Wishlist.unpublish(wishlist: Wishlist): Wishlist` — flip `published` and refresh `updatedAt`; no validation needed (a boolean flip can't fail).
5. As a developer, I want `Wishlist.from(plain)`/`Wishlist.plain(wishlist)` updated to round-trip the three new fields.

### Reservation

6. As a developer, I want a `Reservation` interface: `id: Id`, `item: Id`, `name: string`, `token: string`, `createdAt: Date` — no `updatedAt` (immutable once placed; the only domain operation is create — cancel is not modeled at this layer, see Out of Scope).
7. As a developer, I want `Reservation.create(input: { item: Id; name: string })` to treat `item` as an already-trusted `Id` (no re-validation, per PRD-0003/0004/0005/0007 precedent), validate `name` as non-empty, auto-generate `id` and an opaque `token`, stamp `createdAt`, and return `Result<Reservation, DomainFailure>`.
8. As a developer, I want `Reservation.from(plain)`/`Reservation.plain(reservation)` per ADR-0007/0009.

## Implementation Decisions

- **File locations:** `Wishlist` changes stay in `libs/domain/src/lib/wishlist/wishlist.ts`. New `Reservation` at `libs/domain/src/lib/reservation/reservation.ts`, following the `Coupon`/`CouponRule` folder pattern.
- **`slug`/`token` generation:** both opaque strings via `randomUUID()` (`node:crypto`), same primitive `Id.generate()` already uses — reusing an established, dependency-free source rather than introducing a new opaque-string generator (e.g. `nanoid`) for what's currently a single field. Not exposed as a branded `Id`-like type since neither is used as an entity identity or FK — they're bearer strings.
- **`Wishlist.$` schema:** grows one field over its prior shape — `{ name: z.string().min(1), style: z.enum(['default', 'surprise']).default('surprise') }`. `slug`/`published` stay auto-stamped outside the schema entirely (same treatment as `id`/`createdAt`/`updatedAt`); `style` is the one new field that's validated caller input, with the default applied by `zod` itself when the caller omits it.
- **`Reservation.$` schema:** `z.object({ name: z.string().min(1) })` — `item` is `Id`-typed at the function boundary, not part of the `zod` schema, matching `Wishlist.create`'s treatment of `user`.
- **`publish`/`unpublish`** don't go through `Result`/`zod` at all (unlike `rename`) — there's nothing to validate; a boolean flip can't produce an invalid state. They return `Wishlist` directly, not `Result<Wishlist, DomainFailure>`.
- **One-Reservation-per-Item** is a `libs/database` unique constraint on `Reservation.item`, not a `libs/domain` check — same precedent as `Category.name` (PRD-0004) and `Coupon.code` (PRD-0007) uniqueness, both deferred to the database layer rather than threaded into `create` as a cross-entity list check.
- **Reservation is Pro-only**, but nothing in `Reservation.create`'s signature reflects that — the service layer fetches the Wishlist owner's `User`, checks `plan === 'pro'` (ADR-0012), and only calls `Reservation.create` if that passes. Same treatment as `CouponRule`'s Pro-gating (PRD-0007), which also isn't threaded into the domain function itself.
- **Surprise Mode enforcement** (actually filtering Reservations out of an owner's view when `style === 'surprise'`) is explicitly deferred — see Out of Scope. This PRD only establishes the `style` field and its type narrowing.

## Testing Decisions

- `Wishlist.create`: now also asserts a generated `slug` is present, `published` defaults `true`, `style` defaults `'surprise'` when omitted, accepts an explicit `style: 'default'`, and rejects an invalid `style` string with a `DomainFailure` (the new `zod`-validated path this PRD introduces, unlike the previously-auto-stamped fields).
- `Wishlist.regenerateSlug`: produces a different `slug` than the input, refreshes `updatedAt`, leaves `published`/`style`/`id`/`user`/`name` unchanged.
- `Wishlist.publish`/`unpublish`: flips `published`, refreshes `updatedAt`.
- `Wishlist.from(Wishlist.plain(wishlist))` round-trips including the three new fields, for both `style` variants.
- `Reservation.create`: valid input builds a `Reservation` with generated `id`, generated `token`, stamped `createdAt`; empty `name` fails with `DomainFailure`.
- `Reservation.from(Reservation.plain(reservation))` round-trips.
- Test runner: Vitest.

## Out of Scope

- **Cancelling a Reservation entirely** — matching the token against `reservation.token`, deleting the record, and whatever error shape that produces (`DomainFailure` needs a non-`'validation'` kind for a token mismatch, which doesn't exist yet) are all deferred to a future PRD. Grilling concluded this isn't a domain-level concept at all — it's a service-layer operation (compare token, call the repository delete) — so no `Reservation.cancel` function, no new `DomainFailureType`, in this PRD.
- Actually filtering/hiding Reservations from an owner's view based on `style` (the "sanitize" mechanism raised and explicitly deferred during grilling) — a future PRD's concern, likely living alongside whatever service-layer function assembles a Wishlist + its Items + their Reservations for display.
- One-Reservation-per-Item enforcement at the domain layer — pushed to `libs/database` (see Implementation Decisions).
- Pro-plan gating logic itself — service-layer concern, not `libs/domain` (same as `CouponRule`, PRD-0007).
- Transporting `Reservation.token` to the correct client and nowhere else — API/service-layer concern (see ADR-0015).
- `Reservation` edit functions beyond `create` — create-only, no rename/reassign/cancel.
- Orchestrating `slug` uniqueness at the database level — same treatment as `Coupon.code`, assumed but not specced here.
- Any UI/routing concern for the actual shared-link page.

## Further Notes

- Depends on `libs/domain` foundation: `Id`, `DomainFailure`, `Plain<T>`, the namespace pattern (ADR-0007), `Wishlist`'s existing shape (PRD-0006), and ADR-0012's literal-field narrowing as the direct precedent for `style`.
- Introduces ADR-0015 (token-based authorization for anonymous actors) — the first domain concept whose actor isn't an authenticated `User`. Establishes the token field and its generation; cancelling with it is the next PRD's concern.
- Does not fully close out the `sharing` feature area named in ADR-0004's initial feature-slice list — Reservation cancellation remains open, picked up by the next PRD. `tracking` (Tracked Item, Price History) still follows after that.

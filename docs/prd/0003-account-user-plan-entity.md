## Problem Statement

`libs/domain`'s foundation — branded types, the namespace pattern, discriminated unions, `Plain<T>`, `Failure`/`DomainFailure` (ADR-0005–0011) — is built, but no actual entity exists yet. Every other planned entity references a User's `Id` (`Wishlist`, `Item`, `Category`, `Coupon` all belong to a User per `CONTEXT.md`), and `Plan` gates Pro-only behavior described across Coupon Rule, Reservation, and Tracked Item. The Account slice (`User`, `Plan`) needs to exist before any of those can be specced concretely.

## Solution

Add a `User` entity to `libs/domain` (interface + namespace with `create`/`from`/`plain`, per ADR-0007), carrying identity (`id`, `email`, `name`), OAuth linkage (`provider`, `providerId`), `Plan` as a plain literal field (`plan: 'free' | 'pro'`, per ADR-0006's `Currency` precedent — no separate `Plan` entity), and audit timestamps (`createdAt`, `updatedAt`). `ProUser`/`FreeUser` narrow `User` by its `plan` field (ADR-0012), so Plan-gated function signatures get compile-time enforcement later without runtime Guard classes existing yet.

## User Stories

1. As a developer, I want a `User` interface with `id: Id`, `email: Email`, `name: string`, `provider: string`, `providerId: string`, `plan: Plan`, `createdAt: Date`, `updatedAt: Date`, so the entity captures everything CONTEXT.md's User definition needs.
2. As a developer, I want `type Plan = 'free' | 'pro'`, a plain string-literal union (not a branded type or its own entity), so it's treated the same as `Currency` (ADR-0006) — no `Id`, no `create`/`from`/`plain` of its own.
3. As a developer, I want `User.create(input)` to accept `{ email, name, provider, providerId }` — raw OAuth-callback-derived fields — validate them via `zod`, and return `Result<FreeUser, DomainFailure>`, so untrusted OAuth data can't produce an invalid `User`, and the type reflects that new accounts always start on Free.
4. As a developer, I want `User.create` to auto-generate `id` via `Id.generate()`, default `plan` to `'free'`, and stamp `createdAt`/`updatedAt` to the same value, so callers don't have to supply derived fields.
5. As a developer, I want `email` validated via the existing `Email.$` schema (lowercased, format-checked), reused as a sub-schema rather than re-implemented.
6. As a developer, I want `name`, `provider`, and `providerId` validated as non-empty strings (`z.string().min(1)`), so blank OAuth profile data fails fast with a `DomainFailure`.
7. As a developer, I want `provider` typed as a plain `string`, not a closed literal union, so new OAuth providers can be added without a domain-layer type change.
8. As a developer, I want `User.from(plain)` to reconstruct a `User` (the full `ProUser | FreeUser` union, not narrowed to `FreeUser`) from a trusted database row with no re-validation, so rows already carrying `plan: 'pro'` (written by a future billing integration, even before a domain-level upgrade function exists) reconstruct correctly.
9. As a developer, I want `User.plain(user)` to produce `Plain<User>` — `id`/`email` unbranded to `string`, `createdAt`/`updatedAt` to ISO strings, per ADR-0009 — for persistence and API responses.
10. As a developer, I want `User` to hold no `wishlistIds`/`categoryIds` arrays, so ownership stays normalized — `Wishlist`/`Category` (specced in future PRDs) each carry a `userId` instead, per ADR-0007's by-reference composition.
11. As a developer, I want `ProUser`/`FreeUser` defined as `User & { plan: 'pro' }` / `User & { plan: 'free' }` (ADR-0012), so a future Pro-only function signature like `trackItem(user: ProUser)` rejects a `FreeUser` at compile time.
12. As a developer, I want email/providerId uniqueness enforced at the database layer (unique constraint in `libs/database`), not in `User.create`, so domain validation stays about shape/format, not cross-row constraints.

## Implementation Decisions

- **File location:** `libs/domain/src/lib/user/user.ts`, following the `Id`/`Email` folder pattern (`user.ts` + `user.spec.ts`).
- **`Plan` lives in `user.ts`** (`export type Plan = 'free' | 'pro';`), not its own file — it's User-only for now; extract later if a second consumer needs it.
- **Validation schema:** a single `zod` object schema composing `Email.$` for the email field:
  ```ts
  const $ = z.object({
    email: Email.$,
    name: z.string().min(1),
    provider: z.string().min(1),
    providerId: z.string().min(1),
  });
  ```
- **`create(input): Result<FreeUser, DomainFailure>`** — parses `$`, generates `Id.generate()`, defaults `plan: 'free'`, sets `createdAt`/`updatedAt` to `new Date()`, wraps `ZodError` via `DomainFailure.validation(...).context('Creating User')` (mirrors `Id`/`Email`).
- **`from(plain: Plain<User>): User`** — trusted reconstruction, `as Id`/`as Email` casts per ADR-0006, returns the union type since a stored row may carry either plan.
- **`plain(user: User): Plain<User>`** — hand-written field mapping per ADR-0007 (not generated); `Plain<T>`'s conditional type ordering (ADR-0009) enforces completeness at the type level.
- **`ProUser`/`FreeUser`** exported as type aliases alongside `User` in the same file, per ADR-0012.

## Testing Decisions

- `User.create`: valid input produces a `FreeUser` with a generated `id`, `plan: 'free'`, and equal `createdAt`/`updatedAt`; missing/invalid `email`, empty `name`/`provider`/`providerId` each produce a `DomainFailure` with the expected `issues`.
- Round-trip: `User.from(User.plain(user))` deep-equals the original `user`, for both a `FreeUser`-shaped and a `ProUser`-shaped input plain object.
- Type-level: a `vitest` `expectTypeOf` assertion that a `FreeUser` is not assignable where `ProUser` is expected (and vice versa), verifying ADR-0012's narrowing actually compiles as intended.
- Test runner: Vitest, consistent with the rest of `libs/domain`.

## Out of Scope

- `User.upgrade`/`User.downgrade` (Plan transition functions) — deferred; likely specced alongside billing/webhook integration in a future PRD.
- Guard classes (`ProPlanGuard`/`FreePlanGuard`, `plan.track(user)`-style behavior) — ADR-0012 covers only the type-narrowing mechanism; the enforcement classes get their own PRD once a feature (Tracking or Coupon Rule) actually needs Plan-gated behavior.
- Email/providerId uniqueness constraints — a `libs/database` schema concern, not domain validation.
- OAuth login/session flow itself (`apps/api` auth module, provider SDK integration) — this PRD only covers the `User` entity shape.
- `Wishlist` and `Category` entities — separate future PRDs per ADR-0004's feature list, even though `CONTEXT.md` describes them as User-owned.

## Further Notes

- Depends on already-implemented `libs/domain` foundation: `Id` (ADR-0006), `Email` (ADR-0006), `DomainFailure` (ADR-0010), `Plain<T>` (ADR-0009), the namespace pattern (ADR-0007).
- Introduces ADR-0012 alongside this PRD for the `ProUser`/`FreeUser` narrowing pattern.
- `CONTEXT.md` already defines `User`/`Plan` vocabulary; no glossary changes needed here — `ProUser`/`FreeUser` are implementation-level narrowing types, not new domain vocabulary.

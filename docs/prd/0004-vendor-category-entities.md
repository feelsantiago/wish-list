## Problem Statement

`Item` (a future PRD) belongs to exactly one `Vendor` and optionally one `Category` (`CONTEXT.md`). Both need concrete types before `Item` can be specced. `Vendor` also needs two domain value types that don't exist yet — a branded hostname (`RegistrableDomain`, anticipated by ADR-0006 but never implemented) and a branded URL (`Url`, new) — plus the first real implementation of `Currency` (ADR-0006 named it, deferred the concrete union).

## Solution

Add `Vendor` and `Category` entities to `libs/domain` (interface + namespace, ADR-0007), along with three supporting value types: `RegistrableDomain` (branded string, format-validated only — no URL parsing in the domain layer), `Url` (branded string, shared for `Vendor.website` now and `Item.url` later), and `Currency` (plain literal union `'USD' | 'BRL'`, ADR-0006). Field names follow ADR-0013 (`Category.user: Id`, `Vendor.website: Url`). `Category.color` uses `Option<string>` (ADR-0009) rather than an optional/nullable field directly.

## User Stories

### Vendor

1. As a developer, I want a `Vendor` interface with `id: Id`, `registrableDomain: RegistrableDomain`, `website: Url`, `name: string`, `currency: Currency`, `createdAt: Date`, `updatedAt: Date`.
2. As a developer, I want `Vendor.create(input: { registrableDomain: string; website: string; name: string; currency: Currency })` to validate via `zod` and return `Result<Vendor, DomainFailure>`, auto-generating `id` and stamping `createdAt`/`updatedAt`.
3. As a developer, I want the domain layer to do no URL parsing or LLM calls — the feature service layer extracts `registrableDomain` from a raw Item URL (via a PSL-aware library like `tldts`) *before* calling `Vendor.create`; the domain layer only validates the already-extracted string's shape.
4. As a developer, I want `RegistrableDomain` as a branded `string` (ADR-0006) with `RegistrableDomain.$` validating hostname format via regex and lowercasing, so `Vendor.registrableDomain` can't hold a raw URL, protocol, or malformed hostname.
5. As a developer, I want a shared branded `Url` type (`Url.$`: `zod` `.url()` plus a protocol-allowlist refine — `http`/`https` only, rejecting `javascript:`/`data:`/`file:` etc.) used by `Vendor.website` today and reused by `Item.url` when that PRD is written, so URL validation isn't reimplemented per entity.
6. As a developer, I want `Currency` implemented as `type Currency = 'USD' | 'BRL'` in its own file (`Currency.$` = `z.enum(['USD', 'BRL'])`), extracted now rather than inlined, since `Vendor.currency` is the first of at least two anticipated consumers (`Item`'s scraped price currency, `CouponRule`'s threshold currency, per ADR-0002).
7. As a developer, I want `Vendor.name` supplied by the caller (not derived from the domain), validated as a non-empty string.
8. As a developer, I want `Vendor.from(plain)` (trusted reconstruction) and `Vendor.plain(vendor)` (produces `Plain<Vendor>`), per ADR-0007/0009.
9. As a developer, I want "one Vendor per registrable domain, created the first time it's seen" (`CONTEXT.md`) handled as a lookup-before-create in the vendor feature's service layer — `Vendor.create` itself has no dedup responsibility; it just builds a valid `Vendor` from already-decided-new input.

### Category

10. As a developer, I want a `Category` interface with `id: Id`, `user: Id`, `name: string`, `color: Option<string>`, `isDefault: boolean`, `createdAt: Date`, `updatedAt: Date` (ADR-0013 naming).
11. As a developer, I want `Category.create(input: { user: Id; name: string; color?: string })` to treat `user` as an already-trusted `Id` (the caller already has an authenticated User in hand — no re-validation, per ADR-0007's create-validates-untrusted-input / from-trusts-internal-values split), validate `name` as non-empty, and validate `color` (when present) as a hex string (`/^#[0-9a-fA-F]{6}$/`), producing `Option.some(color)` or `Option.none()`. `isDefault` always defaults to `false` from this function — a regular `Category.create` call never produces a protected category.
12. As a developer, I want a separate `Category.createDefault(user: Id)` that produces a Category named `'Unsorted'` with `isDefault: true`, so account signup (a future Account-feature service, not this PRD) can provision it without exposing `isDefault` as caller-settable input to the general `create` path.
13. As a developer, I want `isDefault: true` categories to be rejected by future rename/recolor/delete functions (not yet specced — noted here so the field's purpose is on record before those functions are written).
14. As a developer, I want `Category.from(plain)` to reconstruct `color` via `Option.fromNullable(plain.color)`, since `Plain<Option<X>>` is `X | null` (ADR-0009).
15. As a developer, I want `Category.plain(category)` to convert `color` back to `string | null`.
16. As a developer, I want Category name uniqueness per User enforced by a database constraint (`libs/database`, unique on `(user, name)`), not by `Category.create` — consistent with how `User`'s email/providerId uniqueness was scoped (PRD-0003).

## Implementation Decisions

- **File locations:** `libs/domain/src/lib/vendor/vendor.ts`, `.../category/category.ts`, `.../registrable-domain/registrable-domain.ts`, `.../url/url.ts`, `.../currency/currency.ts` — each following the `Id`/`Email` folder pattern (`<name>.ts` + `<name>.spec.ts`).
- **`RegistrableDomain.$`:** `z.string().regex(HOSTNAME_PATTERN).transform((v) => v.toLowerCase())`. No PSL/`tldts` logic inside `libs/domain` — that library is a dependency of the vendor feature's `service` lib, not `libs/domain`.
- **`Url.$`:** `z.string().url().refine(isHttpOrHttpsProtocol)`.
- **`Currency.$`:** `z.enum(['USD', 'BRL'])`.
- **Category color regex:** `/^#[0-9a-fA-F]{6}$/`.
- **`Vendor.create`/`Category.create`** both compose a single `zod` object schema and `Result.fromThrowable`, matching the `Id`/`Email`/`User` pattern (PRD-0003) — wrap `ZodError` via `DomainFailure.validation(...).context(...)`.
- **Trusted cross-entity `Id` fields:** `Category.create`'s `user: Id` parameter is passed through unchanged, not re-validated — first application of this rule (previously implicit in ADR-0007, now explicit); applies to all future FK-style fields (`Item.vendor`, `Item.category`, etc.).
- **Field naming** follows ADR-0013 throughout this PRD.

## Testing Decisions

- `RegistrableDomain.create`: valid hostname passes and lowercases; input containing a protocol, path, spaces, or empty string fails with `DomainFailure`.
- `Url.create`: valid `http`/`https` URL passes; `javascript:`/`data:` schemes and malformed strings are rejected.
- `Currency.$`: rejects any value outside `'USD' | 'BRL'`.
- `Vendor.create`: valid input builds a `Vendor` with a generated `id` and equal `createdAt`/`updatedAt`; each invalid field (`registrableDomain`, `website`, `name`, `currency`) independently produces a `DomainFailure`.
- `Vendor.from(Vendor.plain(vendor))` round-trips to a deep-equal `Vendor`.
- `Category.create`: with `color` produces `Option.some(color)`; without `color` produces `Option.none()`; malformed hex `color` fails.
- `Category.from(Category.plain(category))` round-trips correctly through the `Option<string>` ↔ `string | null` conversion, for both a colored and colorless `Category`.
- Test runner: Vitest, consistent with existing `libs/domain` specs.

## Out of Scope

- Vendor lookup-or-create ("first time it's seen" dedup by `registrableDomain`) — vendor feature `service` lib concern.
- `tldts`-based URL-to-`registrableDomain` extraction — feature service layer, not `libs/domain`.
- `Vendor.name`/`website` edit functions — `updatedAt` exists on the type, but no mutation function is specced yet.
- `Category.rename()`/`Category.recolor()` functions — same reasoning; `updatedAt` exists, mutation functions don't yet.
- Category name uniqueness enforcement — `libs/database` schema concern.
- Orchestrating `Category.createDefault` alongside `User.create` at signup — an Account-feature service concern, not this PRD's domain-layer scope.
- `Item` itself, which will reference both `Vendor` and `Category` by `Id` — future PRD, and is the reason `Item.category` can be a required `Id` rather than `Option<Id>` (every User always has an Unsorted Category).

## Further Notes

- Depends on `libs/domain` foundation: `Id`, `DomainFailure`, `Plain<T>` (ADR-0009), `Option` (`libs/common/result`), the namespace pattern (ADR-0007), and PRD-0003's `User` as the reference implementation for the `create`/`from`/`plain` shape.
- Introduces ADR-0013 (no-redundant-type-suffix field naming), applied here for the first time.
- `Currency` (named in ADR-0006) gets its first concrete implementation in this PRD.

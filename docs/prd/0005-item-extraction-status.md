## Problem Statement

`Item` is the central entity of wish-list — captured from a pasted URL, scraped async via LLM (ADR-0001), belonging to a Vendor (PRD-0004) and Category (PRD-0004, always present via Unsorted default). Its design has two independent state axes described in `CONTEXT.md` and already partly decided in ADR-0008 (Extraction Status as a `_tag` union) and ADR-0012 (Plan-style literal-field narrowing, now reused for Status). Neither axis has concrete field lists or transition functions yet.

## Solution

Add `Item` to `libs/domain` as a `_tag`-discriminated union (`PendingItem | ExtractedItem | FailedExtractionItem`, ADR-0008) sharing a `BaseItem` interface, independently narrowable into `WantedItem | FulfilledItem` via its `status` field (ADR-0012, amended). Add a `Money` value type (`{ amount: number; currency: Currency }`) for `ExtractedItem.price`, reusing `Url` (PRD-0004) for `Item.url` and `ExtractedItem.image`. Domain-layer transition functions (`extract`, `failExtraction`, `retryExtraction`, `correctManually`) cover the state changes ADR-0008 already identifies as domain concerns; simple field toggles (marking Fulfilled/Wanted) are left to the service layer per this session's direction to keep `libs/domain` about shapes, not general business logic.

## User Stories

### BaseItem / shared shape

1. As a developer, I want `BaseItem` with `id: Id`, `wishlist: Id`, `vendor: Id`, `category: Id`, `url: Url`, `status: 'wanted' | 'fulfilled'`, `createdAt: Date`, `updatedAt: Date` (ADR-0013 naming) — the fields valid across every Extraction Status variant.
2. As a developer, I want `wishlist`, `vendor`, and `category` treated as already-trusted `Id`s at creation (the item feature's service layer resolves/creates the Vendor, defaults to the User's Unsorted Category, and confirms Wishlist ownership before calling `Item.create`) — no re-validation, per PRD-0004's precedent.
3. As a developer, I want `url` validated via `Url.create` *inside* `Item.create`, since it's genuinely untrusted user-pasted input — unlike the FK fields above.
4. As a developer, I want `status` to always default to `'wanted'` at creation — there's no path to create an already-Fulfilled Item.

### Extraction Status (`_tag` union, ADR-0008)

5. As a developer, I want `PendingItem extends BaseItem { _tag: 'pending' }` — no name/price/image fields exist on this variant at all (not optional — absent).
6. As a developer, I want `ExtractedItem extends BaseItem { _tag: 'extracted'; name: string; price: Money; image: Url }` — all metadata fields populated and required.
7. As a developer, I want `FailedExtractionItem extends BaseItem { _tag: 'failed'; reason: string }` — no name/price/image, but a human-readable `reason` (e.g. `'page returned 403'`, `'LLM response malformed'`) so the UI can tell the user roughly why manual entry is needed.
8. As a developer, I want `Item.create(input: { wishlist: Id; vendor: Id; category: Id; url: string })` to return `Result<PendingItem, DomainFailure>` — every new Item starts Pending, regardless of extraction happening synchronously or async later.
9. As a developer, I want `Item.extract(pending: PendingItem, data: { name: string; price: Money; image: string })` to validate `data` (non-empty `name`, `image` via `Url.create`) and return `Result<ExtractedItem, DomainFailure>`, stamping `updatedAt`.
10. As a developer, I want `Item.failExtraction(pending: PendingItem, reason: string): FailedExtractionItem` — no validation beyond non-empty `reason`, stamping `updatedAt`. Not wrapped in `Result` beyond that trivial check, since there's no meaningful failure mode for this transition itself.
11. As a developer, I want `Item.retryExtraction(failed: FailedExtractionItem): PendingItem` — pure state transition, no input data, no validation, per ADR-0008's consequence.
12. As a developer, I want `Item.correctManually(item: FailedExtractionItem | ExtractedItem, data: { name: string; price: Money; image: string }): Result<ExtractedItem, DomainFailure>` — usable both to fill blanks after a failure and to fix a wrong prior extraction, since `CONTEXT.md` doesn't restrict manual correction to the failure case.

### Status (literal-field narrowing, ADR-0012 amended)

13. As a developer, I want `WantedItem = Item & { status: 'wanted' }` and `FulfilledItem = Item & { status: 'fulfilled' }` exported as type aliases, where `Item = PendingItem | ExtractedItem | FailedExtractionItem` — distributing automatically over the `_tag` union (no hand-written cross-product interfaces, per the ADR-0008 amendment).
14. As a developer, I want no `markFulfilled`/`markWanted` functions in `libs/domain` — flipping `status` is a service-layer concern; `libs/domain` only provides the narrowed types so a future service function's signature (e.g. `purchased(item: WantedItem)`) gets compile-time enforcement.

### Money

15. As a developer, I want `Money = { amount: number; currency: Currency }`, with `Money.create(amount: number, currency: Currency): Result<Money, DomainFailure>` validating `amount` is a positive finite number (zero/negative is treated as an extraction anomaly, not a valid price).
16. As a developer, I want `Money` to have no comparison/arithmetic helpers in this PRD — same-currency comparison (ADR-0002) is Coupon Rule's concern, specced when that PRD is written.

### Lifecycle

17. As a developer, I want `Item.from(plain)` to dispatch on `_tag` to reconstruct the correct variant, trusted, no re-validation (ADR-0007/0008).
18. As a developer, I want `Item.plain(item)` producing `Plain<Item>`, distributing over the `_tag` union automatically (ADR-0009), `_tag` and `status` both passing through unchanged.
19. As a developer, I want cross-variant utilities `Item.isPending`, `Item.isExtracted`, `Item.isFailed` on the `Item` namespace (ADR-0008's consequence), each a type guard narrowing on `_tag`.

## Implementation Decisions

- **File locations:** `libs/domain/src/lib/item/item.ts` (BaseItem + three `_tag` variants + `Item` namespace + `WantedItem`/`FulfilledItem` aliases), `libs/domain/src/lib/money/money.ts`.
- **`Money.$`:** `z.object({ amount: z.number().positive().finite(), currency: Currency.$ })`.
- **`Item.create`'s schema:** `z.object({ url: Url.$ })` for the untrusted portion; `wishlist`/`vendor`/`category` are typed `Id` directly (already `Id`-typed values, not strings, at the function boundary) and passed through.
- **`_tag` values:** `'pending' | 'extracted' | 'failed'`, matching ADR-0008's naming.
- **`reason` on `FailedExtractionItem`:** plain `string`, not `Failure`/`DomainFailure` — it's a user-facing message, not an internal error chain; the actual scraping error (if any) is logged separately by the extraction service, not carried on the entity.
- **`updatedAt`** is refreshed by every transition function (`extract`, `failExtraction`, `retryExtraction`, `correctManually`), each producing a new object per the plain-data, no-mutation style (ADR-0008's consequence, extended here to Status/Extraction transitions alike).
- **`Item.correctManually`'s input type** is the union `FailedExtractionItem | ExtractedItem`, output is always `ExtractedItem` — TypeScript narrows correctly since both input members share the base fields needed to construct the output.

## Testing Decisions

- `Item.create`: valid input produces a `PendingItem` with `status: 'wanted'`, generated `id`, matching `createdAt`/`updatedAt`; invalid `url` produces `DomainFailure`.
- `Item.extract`: valid `data` transitions a `PendingItem` to `ExtractedItem` with all fields populated and `updatedAt` refreshed; invalid `name`/`image`/`price` each fail independently.
- `Item.failExtraction`: produces `FailedExtractionItem` with the given `reason`, `updatedAt` refreshed.
- `Item.retryExtraction`: `FailedExtractionItem` → `PendingItem`, no `reason`/name/price/image on the result.
- `Item.correctManually`: both a `FailedExtractionItem` input and an `ExtractedItem` input independently produce a correct `ExtractedItem`.
- `Money.create`: rejects `0`, negative, `NaN`, `Infinity`; accepts any positive finite number with a valid `Currency`.
- Round-trip: `Item.from(Item.plain(item))` deep-equals the original, for all three `_tag` variants.
- Type-level (`expectTypeOf`, per PRD-0003's precedent): a `FulfilledItem` is not assignable where `WantedItem` is expected, and vice versa; verify the `WantedItem`/`FulfilledItem` aliases still distribute correctly over all three `_tag` variants (i.e. `WantedItem` includes a Wanted `PendingItem`, a Wanted `ExtractedItem`, and a Wanted `FailedExtractionItem`).
- Test runner: Vitest.

## Out of Scope

- `markFulfilled`/`markWanted` (or any Status-flipping function) — service-layer concern; this PRD only provides the narrowed types.
- The extraction pipeline itself (LLM call, prompt, retry/backoff policy) — a future item-feature `service` lib concern; this PRD only covers the domain transitions triggered by its outcome.
- `Money` comparison/arithmetic helpers — deferred to Coupon Rule's PRD (ADR-0002's same-currency comparison rule).
- Vendor lookup-or-create and Category-defaulting-to-Unsorted orchestration ahead of `Item.create` — item-feature service concern (PRD-0004's Out of Scope already covers the Vendor half).
- `Wishlist` itself — referenced here only by `Id`; its own PRD is still future work, but ADR-0007's by-reference composition means `Item` doesn't need `Wishlist`'s fields to exist first.

## Further Notes

- Amends ADR-0008: the paragraph on Wanted/Fulfilled `Status` now points at ADR-0012's narrowing mechanism instead of asserting a plain-field-only approach; a new Consequences bullet documents that the two axes (`_tag`, `status`) compose via distributive intersection without hand-written cross-product interfaces.
- Depends on PRD-0004 (`Url`, `Currency`, `Vendor`, `Category`) and PRD-0003 (`User`, indirectly via Wishlist/Category ownership).
- `ts-pattern` exhaustiveness (mentioned in ADR-0008) is expected to be used wherever code matches on `_tag`, once such code exists (service layer, not this PRD).

# Vendor provisional and resolved states

`CONTEXT.md` says an Item "is created immediately from just its URL and exists in a
pending state until scraping fills in its fields", and that a Vendor is "derived
automatically from the URL's registrable domain the first time it's seen". Those two
statements are in tension with the entity shapes: `Item.vendor: Id` is required on
`BaseItem` — every Item state, including `pending` — while `Vendor.create` requires
`name` and `currency`, neither of which is derivable from a URL. `currency` in particular
is intrinsic to Vendor identity (`CONTEXT.md`: `amazon.com` and `amazon.com.br` are
distinct Vendors "since they also differ in Currency") and is only knowable after a
successful extraction.

We resolve it by making `Vendor` a discriminated union on `_tag`, the same shape ADR-0008
established for `Item`:

```ts
interface ProvisionalVendor extends BaseVendor {
  _tag: 'provisional';
}
interface ResolvedVendor extends BaseVendor {
  _tag: 'resolved';
  name: string;
  currency: Currency;
}
```

A `ProvisionalVendor` is constructible from a URL alone. Extraction promotes it in place
via `Vendor.resolve(vendor, data)` the first time _any_ Item on that registrable domain
extracts successfully, so a domain never accumulates duplicate Vendor rows.

`VendorDomain` additionally gains `fromUrl()`, backed by a public-suffix list (`tldts`),
because the existing hostname regex validates shape but does not reduce to the
registrable domain — without it `www.amazon.com` and `amazon.com` are two Vendors and
`amazon.com.br` cannot be reduced correctly.

## Considered options

- **Move `vendor` off `BaseItem` onto `ExtractedItem` only.** A smaller domain change:
  pending Items simply have no Vendor. But `FailedExtractionItem` then has none either,
  and `Item.correct()` — the manual-entry escape hatch for bot-walled retailers — would
  have to resolve a Vendor itself, relocating the same problem into a worse place.
  Rejected.
- **Fail Item creation when inline extraction fails.** No Vendor problem, no pending
  state, no retry infrastructure, and by far the simplest system. But it contradicts
  `CONTEXT.md`'s Extraction Status term outright and removes manual entry after failure,
  which is the only recourse on retailers that block scrapers. Rejected.
- **Create the Vendor with a placeholder currency, correct it after extraction.** No type
  change, but a wrong `Currency` is silently persisted and, per ADR-0002, currencies are
  never converted or normalized — a Coupon or Coupon Rule created against the placeholder
  would be validated against a currency the Vendor doesn't actually use. Rejected: silent
  wrong data is worse than an explicit absent state.
- **Discriminated union (chosen).** Keeps `Item.vendor` required in every state, keeps
  `CONTEXT.md` literally true, and puts the incompleteness on the entity that is actually
  incomplete.

## Consequences

- A `Coupon` or `CouponRule` cannot attach to a provisional Vendor — both need its
  `Currency` to enforce ADR-0014's cross-entity invariant. Enforced by the type rather
  than by a runtime check. Both are Pro features landing later, so nothing regresses.
- `vendors` gains a `_tag` column with nullable `name`/`currency`, following ADR-0017's
  single-table mapping for `Item`. `vendor.mapper.ts` stops using the generic
  `DatabaseDomainMapper.create(Vendor.plain, Vendor.from)` and becomes a bespoke mapper
  with `ts-pattern` matches in both directions, as `ItemDatabaseDomainMapper` already does.
- Promotion is the only transition. There is no demotion — a resolved Vendor never
  returns to provisional, even if a later extraction on that domain fails.
- `tldts` becomes a `libs/domain` dependency. It carries a bundled public-suffix list,
  which is data that goes stale; refreshing it is a dependency bump, not a code change.

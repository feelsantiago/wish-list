# Cross-entity value passing when a create-time invariant needs it

`Coupon.create` (fixed-discount variant) and `CouponRule.create` must reject a `Money` (discount amount / threshold) whose `Currency` doesn't match the `Vendor`'s own `Currency` — comparing amounts across currencies is meaningless (ADR-0002). PRD-0003/0004/0005 established that cross-entity FK fields (`Category.user`, `Item.vendor`, etc.) are passed as an already-trusted `Id` and never re-validated inside `create`. That precedent is silent on this case: the invariant isn't about the `Id` being well-formed, it's about a *value on the referenced entity* agreeing with a value on the one being created. We extend the pattern rather than break it: `create` accepts the specific field value it needs (`vendorCurrency: Currency`) alongside the trusted `Id`, and validates against that value — it does not accept or re-fetch the whole `Vendor`.

## Considered options

- **Pass the whole related entity** (`Coupon.create(input: { vendor: Vendor; ... })`): gives `create` everything it could ever need, but couples the domain function's signature to another entity's full shape, and risks the caller passing a stale `Vendor` snapshot that no longer matches what's in storage. Rejected.
- **Skip the check, punt to service layer**: keeps `create` signatures untouched, but a currency-mismatch coupon/rule is a domain invariant (same rule as ADR-0002's "never converted or normalized"), not a UI/application concern — letting it slip past the domain layer means every caller has to remember to check it themselves. Rejected.
- **Pass just the needed value(s) (chosen)**: `create` takes the trusted `Id` for identity plus the specific field(s) (`vendorCurrency: Currency`) needed to enforce the invariant. No entity re-validation, no full-entity coupling.

## Consequences

- Establishes the pattern for future entities in the same position: when a `create`-time rule depends on a value that lives on a *referenced* entity, pass that value explicitly (named for what it is, e.g. `vendorCurrency`, not `vendor.currency`) — don't pass the whole entity, and don't skip the check.
- The caller (service layer) is responsible for fetching the referenced entity and extracting the value; the domain layer never fetches anything itself.
- Doesn't apply to the plain FK-`Id`-trust case (`Category.user`, `Item.vendor`) — that precedent is unchanged. This ADR only covers the narrower case where a *value*, not just presence, must be cross-checked.

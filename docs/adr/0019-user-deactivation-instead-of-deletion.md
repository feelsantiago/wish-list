# User deactivation instead of deletion

`User` is never hard-deleted. Instead it carries a `status: 'active' | 'deactivated'` field (`ActiveUser`/`DeactivatedUser`, following the existing `plan`-based narrowing pattern, ADR-0012) plus a `deactivatedAt: Option<Date>` timestamp. Deactivating a User blocks login but leaves every owned row (Wishlists, Items, Categories) untouched; reactivation restores full access exactly as it was. This is deliberately a bare status flag with no side effects on owned data — it does not cascade into unpublishing Wishlists or hiding their share links, which stay governed entirely by `Wishlist`'s own `published` flag (`CONTEXT.md`'s Sharing definition).

We considered hard deletion (hard to reverse, and forecloses any future "why did this account disappear" support/audit need with no timestamp to point to) and deactivation-with-anonymization — scrubbing `email`/`name` on deactivation while keeping rows for referential integrity, which is a real data-retention/compliance feature but a separate decision with its own trade-offs (e.g. does a deactivated User's name still show up as a Reservation's "claimed by" viewer name on a Wishlist?) that shouldn't be folded silently into "how do we stop someone from logging in."

## Consequences

- Every FK cascade decision in the core slice (ADR pending for schema, see grilling session notes) is written as if `User` rows are permanent — `Wishlist.user → User` cascading on delete is a safety net for a code path that, by this decision, should never actually fire in normal operation.
- `user.ts` needs the `status`/`deactivatedAt` fields and `ActiveUser`/`DeactivatedUser` types added — not yet implemented as of this ADR.
- If anonymization-on-deactivation is needed later (compliance ask), it's an additive change to this same `status` field's semantics, not a new mechanism.

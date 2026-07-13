# Token-based authorization for anonymous actors

`Reservation` (PRD-0008) is the first domain concept whose actor isn't a `User` — a Sharing viewer places one without signing in, per `CONTEXT.md`. Every other mutation in this domain is authorized by the caller already being an authenticated, trusted `User` `Id`. That precedent gives no answer for "who's allowed to cancel this Reservation" when there's no account to check against. We generate an opaque `token: string` on `Reservation.create` and return it to the client that created the Reservation — the token itself is the credential, not a `User`. This PRD only establishes the token and issues it; the actual cancel mechanism that checks it (matching against `reservation.token`, then deleting) is a future PRD's service-layer concern, not a `libs/domain` function (see PRD-0008 Out of Scope). This ADR records the authorization *model* now, ahead of that mechanism, since the model determines the field's shape (`Reservation.token`) that's part of this PRD's diff.

## Considered options

- **Open cancel-by-anyone** (any viewer with the Wishlist link can cancel any Reservation): simplest, no new field, but lets one viewer grief another's claim with no recourse — undermines the entire point of Reservation (signaling a claim other viewers should respect). Rejected.
- **Owner-mediated cancel only** (only the Wishlist owner, an authenticated `User`, can remove a Reservation): fits the existing "actor is a `User`" precedent cleanly, but breaks the common case of a viewer simply changing their mind — they'd have to contact the owner out-of-band, which also spoils Surprise Mode's whole premise (owner isn't supposed to be involved). Rejected.
- **Per-Reservation `token` (chosen)**: cheap to add, no accounts needed, same trust tier as the Wishlist's own unlisted `slug` (ADR yet-to-be-written for Sharing itself is unnecessary — this is the same "possession of an opaque string is the authorization" model already implicit in a shareable link).

## Consequences

- Establishes the pattern for any future anonymous-actor action in this domain: issue an opaque token at creation, require it back for any follow-up mutation on that same record. Don't introduce a `User`-shaped actor where none exists.
- The token is a `libs/domain`-level field (`Reservation.token`), but transporting it to the right client (e.g. via response body, not persisted client-side by the server) is a service-layer/API concern, not covered here.
- The cancel mechanism itself (matching the token, deleting the record, and the error shape for a mismatch — likely a new `DomainFailureType` beyond `'validation'`, or a service-layer error entirely) is left to the PRD that builds it. This ADR only commits to the credential model so that PRD isn't re-litigating "why a token and not a `User`."

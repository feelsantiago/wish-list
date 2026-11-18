# Deactivated Users are refused at the request guard

ADR-0032 put `Status` on the mirrored `User` so deactivation takes effect instantly, and
`Authorization.authorize` (ADR-0030) rejects a Deactivated `User` before comparing owners.
That covers every route that goes through `EntityAuthorizer` (ADR-0031), and leaves two gaps:

- **Collection reads skip the authorizer.** `GET /wishlists` uses `QueryScope.user` and
  never builds a bundle, so a Deactivated `User` can still list their data. The same goes
  for any route that touches neither the authorizer nor a scope.
- **Reactivation is self-service.** M1 lists reactivate as an account endpoint, and there is
  no admin role. A rule that refuses a Deactivated `User` everywhere would also refuse the
  one request that undoes it.

**`AuthGuard` (ADR-0038) checks `status` right after `AccountService.resolve`. A
Deactivated `User` is refused with `ServiceFailure.userDeactivated(id)`, which is 403
"Account deactivated" (ADR-0037), unless the handler or controller is marked
`@AllowDeactivated()`.** On every route without that marker, `@CurrentUser()` returns
`ActiveUser`.

`Authorization`'s own check stays. A `UserAuthorized` bundle remains proof on its own for any
caller that never passed the guard, such as a CLI, a worker or a test. Both checks read the
same `User`, so they cannot disagree.

## Considered options

- **The authorizer alone, with `QueryScope.user` requiring `ActiveUser`** (rejected). The
  check moves into domain types and the compiler forces collection reads to narrow first.
  But every collection-read controller repeats the narrowing, and a route that uses neither
  the authorizer nor a scope (`GET /me`, future endpoints) gets no check at all.
- **`AccountService.resolve` refuses** (rejected). It would mix "who is calling" with "may
  they come in", and reactivation would need a second resolve that doesn't refuse.
- **The guard refuses, with an opt-out marker (chosen).** One place, every route, and new
  endpoints are safe by default.

## Consequences

- **`@AllowDeactivated()` is built in M1, together with reactivate**, and possibly
  `GET /me` so the client can offer reactivation. M0 has no route that needs it, so no
  placeholder lands now. On a marked route, `@CurrentUser()` returns `User`, not
  `ActiveUser`.
- **`resolve` runs in full for a Deactivated `User`**, including the name, email and
  provider re-sync, and the guard refuses afterwards. JIT provisioning never creates a
  Deactivated `User`, so first sign-in is unaffected.
- **Two 403s, told apart only by message.** "Account deactivated" and an ownership
  "Forbidden" share a status. Roadmap decision 9 keeps failure tags out of production bodies,
  so a client that needs to branch on the difference in code is a later change to the
  envelope, not something added here.
- **`CONTEXT.md`'s Status entry changes** from "refused at the authorization step" to
  "refused at the request guard, and again at the authorization step for owned entities".
- **ADR-0038's first open item is closed.** What `Identity.name` holds without a `name`
  claim remains open.

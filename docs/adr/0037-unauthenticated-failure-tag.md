# `unauthenticated` and `user-deactivated` join the shared failure vocabulary

M0 step 4 adds the auth guard (ADR-0034), and nothing in the failure vocabulary can produce
a 401. ADR-0020's `ServiceFailureType` stops at `forbidden`, and ADR-0036's `FailureStatus`
table is a `Record` over that union, so any tag outside it falls through to 500. ADR-0036
also left `user-deactivated` (403) for this step.

Guards run before interceptors, so the guard cannot return a `Result` through
`FailureInterceptor`. It throws. `FailureFilter` already catches `FailureHttpException` and
writes the status and message it carries, so the open question is only which tag the guard
uses and where that tag gets its status.

**`'unauthenticated'` and `'user-deactivated'` are added to `ServiceFailureType`, with
`ServiceFailure.unauthenticated(...)` and `ServiceFailure.userDeactivated(...)` factories and
`FailureStatus` entries `{ 401, 'Unauthorized' }` and `{ 403, 'Account deactivated' }`.** The
guard throws `new FailureHttpException(failure, ...FailureStatus.response(failure.name))`,
so the status comes from the same table as every other tag.

"No verified identity" is not an HTTP idea. A CLI or a worker can lack one too, so the tag
keeps ADR-0020's API-agnostic rule and sits next to `forbidden`.

The auth lib owns an `AuthFailure` file, following CLAUDE.md's one-file-per-failure rule. Its
factories all produce the single `'unauthenticated'` tag and carry the cause in a closed
`reason` metadata field:

| factory | `reason` | when |
| --- | --- | --- |
| `AuthFailure.missingToken()` | `missing-token` | no `Authorization: Bearer` header |
| `AuthFailure.invalidToken(cause)` | `invalid-token` | bad signature, wrong `iss`/`aud`, expired, empty `sub`. The `jose` error is the cause |
| `AuthFailure.providerNotAllowed(provider)` | `provider-not-allowed` | `sign_in_provider` is not on ADR-0034's list |
| `AuthFailure.missingEmail()` | `missing-email` | no `email` claim (ADR-0034) |

`user-deactivated` is produced wherever the local `Status` is checked (ADR-0032). Unlike
`unauthenticated`, it names the condition in its message: the caller has proven who they
are, and telling them their own account is deactivated leaks nothing.

## Considered options

- **An auth-lib-only `AuthFailure`, guard hardcodes 401** (rejected). Keeps
  `ServiceFailureType` strictly "what services return", but gives status mapping a second
  home outside `FailureStatus`, against ADR-0036's single table. Any other lookup of the tag
  (`FailureStatus.of('unauthenticated')`) would answer 500.
- **One tag per reason** (`token-missing`, `token-expired`, `provider-not-allowed`, …)
  (rejected). The most precise types, but five tags for one status and one message. The
  client cannot act on the difference, because the Firebase SDK refreshes expired tokens by
  itself. The distinction belongs in logs, so it lives in metadata.
- **One shared tag, reasons in metadata (chosen).**

## Consequences

- **Every 401 body says only "Unauthorized".** Telling the caller which check failed helps
  anyone probing the API. `reason` and the cause chain reach the body only with
  `HTTP_EXPOSE_FAILURES=true` (ADR-0036), which is never on in production.
- **The guard logs the reason itself.** `FailureFilter` logs only ≥ 500, so a 401 would
  otherwise appear as a bare pino-http request line. The guard logs `reason` at `warn`,
  since a burst of `invalid-token` is worth seeing, except `missing-token`, which is logged
  at `debug` because every unauthenticated crawler hit produces one. The token itself is
  never logged, and no claim from an unverified token is.
- **401 responses carry `WWW-Authenticate: Bearer`**, as RFC 7235 requires.
  `FailureHttpException` gains optional response headers and `FailureFilter` writes them. The
  value is plain `Bearer` with no RFC 6750 `error=` parameter, because `error="invalid_token"`
  vs no parameter would reveal the same distinction the generic message hides.
- **The roadmap's status table gains `unauthenticated` → 401.** `user-deactivated` was
  already listed there. ADR-0036's note that it "joins the `Record` in M0 step 4" is now
  satisfied.
- **ADR-0020's base union grows to eight names.** Every service's failure type inherits them.
  Code matching on `ServiceFailureType` exhaustively, today only `FailureStatus`, must handle
  both.

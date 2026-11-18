# Authentication is a horizontal lib; `apps/api` composes it with `AccountService`

ADR-0034 settled how a Firebase ID token is verified, and ADR-0037 settled what a refused
request looks like. Neither says where that code lives. Placing it runs into four existing
rules:

- **Identity** is a `CONTEXT.md` term, and ADR-0004 makes `libs/domain` the shared language
  that every other lib derives its types from. `libs/common` sits below `libs/domain`, so a
  `common` lib cannot use a domain `Identity`.
- Creating a `User` and its Unsorted Category on first sign-in (ADR-0032) writes
  account-owned entities. By ADR-0004's write-ownership convention that belongs to the
  account service.
- Service libs carry no HTTP vocabulary (ADR-0025), so a guard, header parsing and a
  `@Public()` marker cannot live in `libs/account/service`.
- Services never import services and `apps/api` never touches `libs/database` (ADR-0004), so
  only the app can join "verify the token" to "resolve the `User`".

**The work is split three ways, and `apps/api` joins the pieces:**

| piece | lives in | depends on |
| --- | --- | --- |
| `Identity` value | `libs/domain` | `libs/common` |
| `AuthenticationModule`, `IdentityVerifier`, `AuthFailure`, `@Public()` | `libs/authentication` (new, horizontal) | `libs/domain`, `common-error`, `common-http`, `common-logging`, `jose` |
| `AccountService.resolve` | `libs/account/service` (new) | `libs/domain`, `libs/database`, `libs/account/data` |
| `AuthGuard`, `@CurrentUser()` | `apps/api` | all of the above |

- **`Identity`** in `libs/domain` is a pure, broker-agnostic value: `providerId`, `provider`,
  `email` (`Email`), and `name`. Its field types follow `User`'s, so `User.create` can be fed
  from it directly. It knows nothing about Firebase. Claim names, the `sign_in_provider`
  allowlist and its `google.com` → `google` mapping (ADR-0034) belong to the lib that reads
  the token.
- **`libs/authentication`** sits at the same tier as `libs/authorization` and
  `libs/extraction`, and does not import `libs/database`.
  - `AuthenticationModule.forRoot` / `forRootAsync({ projectId, jwks? })` follows
    ADR-0033: `ConfigurableModuleBuilder`, and the app maps `ENV`
    (`FIREBASE_PROJECT_ID`) onto the options.
  - `jwks` defaults to `jose`'s `createRemoteJWKSet` over Google's securetoken endpoint.
    Tests pass a `createLocalJWKSet` built from a key they sign with (ADR-0032).
  - `IdentityVerifier.verify(header)` returns `AsyncResult<Identity, AuthFailure>`. It reads
    the bearer token, verifies it, checks the claims, applies the allowlist and the email
    rule, and logs the refusal reason (ADR-0037).
  - The lib also exports the `AuthFailure` file and the `@Public()` metadata decorator.
- **`libs/account/service`** provides `AccountService.resolve(identity)`, returning
  `AsyncResult<User, ServiceFailure>`.
  - It looks the user up by `providerId` (ADR-0034).
  - On a miss it creates the `User` and the Unsorted Category in one transaction (ADR-0032).
  - On a hit it re-syncs `name`, `email` and `provider` when they differ.
  - It is the account slice's first service, and it opens the slice with its `data` lib.
- **`apps/api`** registers one global `AuthGuard` through `APP_GUARD`, in this order:
  1. Pass routes marked `@Public()` without touching the token.
  2. Call `verifier.verify`, then `accounts.resolve`.
  3. Attach the `User` to the request for `@CurrentUser()` to read.
  4. On any `Failure`, throw `FailureHttpException` with the status from `FailureStatus`
     (ADR-0037).

## Considered options

- **`libs/common/auth`** (rejected). The same tier as `http` and `logging`, but it either
  imports `Identity` from `libs/domain`, which reverses the domain → common direction, or
  keeps its own `Identity` outside the domain, which ADR-0004 forbids.
- **Everything in `libs/account/service`** (rejected). No new lib, but the guard, header
  parsing and `@Public()` are HTTP vocabulary that ADR-0025 keeps out of service libs.
- **The guard in `libs/authentication` behind a resolver port** (rejected for now). The lib
  would define a `USER_RESOLVER` token, generic over the user type, and `apps/api` would
  bind `AccountService` to it. The guard becomes testable inside the lib, but through an
  indirection with one implementation. The app guard only joins two tested calls, so
  end-to-end tests cover it. Revisit if a second app needs the same guard.
- **Horizontal lib, account service, app guard** (chosen).

## Consequences

- **Protected by default.** The guard is global, so a new endpoint needs authentication
  unless it says `@Public()`. Today that is only the health endpoint; M1 adds
  `GET /s/:slug`.
- **Every authenticated request costs one indexed read**, the `providerId` lookup. A first
  sign-in or a drift re-sync costs a write.
- **`libs/authentication` and `libs/authorization` are siblings with separate jobs:** who the
  caller is, and what they may touch. Neither imports the other. `apps/api` passes the
  resolved `User` from the first into the second.
- **`libs/domain` gains `Identity`** with no framework or broker import, keeping ADR-0004's
  rule that the domain is shared unmodified.
- **Leaving Firebase changes only `libs/authentication`.** `Identity`, `AccountService` and
  the guard don't depend on claim names.
- **Open, decided separately:**
  - Whether the guard also refuses a Deactivated `User` with `user-deactivated`. Collection
    reads never reach the authorizer, so today nothing refuses them.
  - What `Identity.name` holds when the token has no `name` claim. `User` requires a
    non-empty name, and GitHub accounts without a display name exist.

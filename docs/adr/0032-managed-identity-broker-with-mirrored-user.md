# A managed identity broker owns login; the local `User` mirrors it

`User` has carried `provider` and `providerId` with a unique index on the pair since
PRD-0003, but nothing has ever written them — there is no `apps/api`, no login, and no
decision on who runs the OAuth exchange. Social logins are a product requirement, and
hand-rolling the exchange means owning redirect state, PKCE, token refresh, cookie flags
and per-provider quirks for every social connection added.

**A managed identity broker owns authentication end to end. `apps/api` verifies the
broker's JWT against its JWKS and never sees a credential.** The local `users` row remains
the only user table and the sole source of truth for everything the domain cares about —
`Plan`, `Status`, and Ownership of Wishlists, Categories and Coupons.

The mirror key keeps its original meaning: `providerId` stores the broker's stable subject
id, and `provider` stores the _social connection the broker reports_ (`'google'`,
`'github'`), not the broker's own name. The alternative — writing a constant broker name
into `provider` — is one character cheaper and throws away the only locally-knowable fact
about how someone signs in.

Provisioning is just-in-time, in the request path: verify token, look up by
(`provider`, `providerId`), and on first sight create the `User` **and** its Unsorted
Category in one transaction, as `CONTEXT.md` requires. When the broker's reported name or
email differs from the stored row, the row is re-synced on that same resolve.

## Considered options

- **Hand-rolled OAuth with a DB-backed session cookie** (rejected). No vendor, full control,
  and instant revocation by deleting a session row. Costs the entire login surface —
  per-provider OAuth flows, state and PKCE, cookie hardening, session lifecycle — which is
  precisely the part with the worst failure mode when written by hand.
- **Hand-rolled OAuth with a stateless JWT** (rejected). Removes the session table and then
  needs a denylist table to revoke, which is a session table under another name.
- **`better-auth` or a similar self-hosted library** (rejected). No vendor and social logins
  supported, but it owns its own `user`, `session` and `account` tables in the same
  database, so the repo would hold two user tables and have to answer "which is canonical"
  on every slice. Session issuance also stays in-process, so the security surface is only
  partly delegated.
- **Supabase Auth** (rejected). The same mirror shape as the chosen option, but its gravity
  is Postgres and this system runs on Turso/libsql.
- **A managed broker with a mirrored local `User`** (chosen).

## Consequences

- **No session table, no session lifecycle code.** The request pipeline is: verify JWT →
  resolve local `User` → `new Authorization(user)`. One indexed read on the steady path.
- **Deactivation is enforced locally and instantly.** `Status` lives on the mirrored row and
  `Authorization.authorize` reads it per request, so a broker token minted before
  deactivation is refused on its next use. This removes the revocation argument that would
  otherwise favour a self-issued session. `CONTEXT.md`'s claim that deactivation "blocks
  login" is now wrong in its literal sense and has been corrected: login succeeds at the
  broker, the request is refused here.
- **Switching brokers invalidates every `providerId`.** Re-onboarding would be a migration
  keyed on email, which is why the unique email index is kept as a real invariant rather
  than relaxed.
- **Account linking is the broker's problem.** One human is one subject id even across
  social providers, so the unique email index cannot be violated by a second sign-in method.
  If the broker is configured _not_ to link, the JIT insert fails on that index — an
  intentionally loud failure rather than a silent duplicate account.
- **The guard depends on the network.** JWKS is cached, and the guard is testable offline by
  signing a token with a local key — it stays a pure verify plus a repository read.
- **First request per new user costs two writes** (User, Unsorted Category) in one
  transaction. A failed transaction leaves no half-provisioned account.
- `libs/domain` is unchanged. This ADR consumes the shape PRD-0003 already built.

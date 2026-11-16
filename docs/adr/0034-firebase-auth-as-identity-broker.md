# Firebase Authentication is the identity broker

ADR-0032 decided that a managed broker owns login and the local `User` mirrors it, and left
the vendor open. The broker has to put a stable subject and the social connection used in
something `apps/api` can verify offline against a JWKS, keep one human as one subject across
social providers, and have a first-party SDK for the Angular client.

**Firebase Authentication is the broker. `apps/api` verifies Firebase ID tokens with `jose`
against Google's public JWKS, checking `iss = https://securetoken.google.com/<projectId>`,
`aud = <projectId>`, and a non-empty `sub`. It does not depend on `firebase-admin`.** The
client signs in with `@angular/fire` and sends the ID token as a bearer token; refreshing it
is the client SDK's job.

The mirror key is filled from these claims:

| `User` field | claim |
| --- | --- |
| `providerId` | `sub` (the Firebase `uid`) |
| `provider` | `firebase.sign_in_provider`, mapped `google.com` → `google`, `github.com` → `github` |
| `email` | `email` |
| `name` | `name` |

The mapping is a closed list. A token whose `sign_in_provider` is not on it (`password`,
`anonymous`, `phone`, a provider enabled in the console by mistake) is refused at the guard,
so turning on a new sign-in method needs a code change as well as a console change.

**The steady-path lookup is by `providerId` alone, not by the (`provider`, `providerId`)
pair ADR-0032 describes.** `sign_in_provider` reports the connection used for *this* sign-in,
so a linked user who signed up with Google and comes back with GitHub keeps the same `sub`
but a different `provider`. A pair lookup would miss, try a JIT insert, and fail on the
unique email index. With Firebase, `sub` is unique on its own, and `provider` is treated as
drift. It is re-synced like name and email and records the most recent social connection,
which keeps ADR-0032's "how someone signs in" meaning.

## Considered options

- **Auth0** (rejected). Official Angular SDK and the most mature product, but linking by
  email needs a hand-written post-login Action, the provider has to be parsed out of a
  `sub` like `google-oauth2|123`, and paid plans cost far more than the free tier.
- **WorkOS AuthKit** (rejected). Very large free tier and automatic linking, but no official
  Angular SDK, and the social connection is not in the access token without a custom
  template.
- **Clerk** (rejected). Built for React; Angular support is community-only.
- **AWS Cognito** (rejected). Linking by email needs a pre-signup Lambda calling
  `AdminLinkProviderForUser`.
- **Zitadel / Logto Cloud** (rejected for now). Plain OIDC and self-hostable later, so the
  lowest lock-in, but smaller ecosystems, and the connection claim needs custom actions.
- **Firebase Authentication** (chosen). Both the connection claim and same-email
  protection work out of the box, and AngularFire is official.

## Consequences

- **Migration: a unique index on `users.provider_id` alone.** The existing pair index can't
  serve a lookup by `providerId` alone, because SQLite indexes only match from their
  leftmost column. The pair index becomes redundant and can be dropped in the same
  migration. This changes ADR-0032's lookup key; its other decisions stand.
- **Linking is not silent.** With *one account per email address* enabled (required),
  Firebase refuses a second provider for an existing email with
  `auth/account-exists-with-different-credential`, and the **client** has to sign in with
  the original provider and call `linkWithCredential`. The web app owns that flow. If it is
  skipped the user is simply refused at Firebase, never duplicated here. Google is a trusted
  email provider and may replace an unverified link (such as GitHub) on the Firebase side.
  That doesn't change `sub`, so the local row is unaffected.
- **No email, no `User`.** `User.create` requires an email. A token without an `email`
  claim (for example a GitHub account with no public or verified address) is refused with
  401 instead of provisioning a broken row. `email_verified` is not required, since Google
  verifies Google emails and GitHub often reports `false`.
- **Env gains `FIREBASE_PROJECT_ID`**, added to `apps/api`'s schema and mapped onto the
  auth module's options per ADR-0033. No service-account credential is needed, because
  verification uses only the public JWKS and revocation is handled by the local `Status`
  (ADR-0032).
- **Emulator tokens are never accepted.** The Firebase Auth emulator issues unsigned
  tokens. Guard tests sign tokens with a local key and inject a local JWKS, as ADR-0032
  planned. The emulator is for client development only.
- **Leaving Firebase** costs the email-keyed re-onboarding migration ADR-0032 describes.
  Firebase can export users with their `uid`, but no other broker will reuse them as
  subjects.
- **Vendor footprint**: a Google Cloud project that holds nothing but auth. Free up to the
  Identity Platform MAU tier (about 50k), metered on Blaze beyond that.

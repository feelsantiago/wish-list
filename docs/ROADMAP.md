# Server layer roadmap

**Scope of "complete": the Free tier, end to end over HTTP.** Auth, wishlists, items,
categories, manual coupons, and public share links. Pro features (Coupon Rule engine,
Reservations, Tracked Items and Price History) keep their existing domain entities and
repositories and get no service or endpoint. Deferred because a User becomes Pro only via
a Subscription concept that `CONTEXT.md` explicitly distinguishes from `Plan` and that no
PRD defines yet — roadmapping it now means inventing domain on the fly.

## What exists

| Lib | State |
| --- | --- |
| `libs/common/result` | `Result`, `Option`, `AsyncResult` — complete |
| `libs/common/error` | `Failure`, `ServiceFailure`, `FailureRenderer`, `ConsoleRenderer` — complete |
| `libs/common/utils` | URL normalisation, in-flight cache, timeout — complete |
| `libs/domain` | 20 modules. Every glossary entity, plus `Authorization`/`UserAuthorized` (ADR-0030) |
| `libs/database` | Drizzle schema, client, transactions, query scopes, mappers and repositories for all 11 tables; test harness. 4 migrations |
| `libs/extraction` | Page fetcher, JSON-LD + OpenGraph parsers, LLM reader, vendor resolver, `Extractor` |
| `libs/item/service` | `ItemService.create` only |

Sharing is already modelled: `wishlists.slug` (unique) + `published` + `style`, with
`Wishlist.publish` / `unpublish` / `regenerateSlug` in the domain. It needs a service and a
controller, nothing more.

## What is missing

- **`apps/` does not exist.** No Nest application, no bootstrap, no env validation, no
  module composition, no HTTP layer.
- **Auth: nothing.** No broker integration, no guard, no `User` resolution, no JIT
  provisioning. `users.provider` / `users.providerId` have never been written to.
- **Logging: nothing.** `FailureRenderer` exists and nothing calls it.
- **Authorization loading: nothing.** `Authorization` is pure and synchronous; no component
  is allowed to load the entities it compares (see ADR-0031).
- **Six of seven feature slices have no `service` lib**: account, wishlist, category,
  coupon, sharing, tracking.
- **`ItemService` has only `create`** — no read, update, delete, move or re-extract.
- **Zero `libs/<feature>/data` libs**, though ADR-0004 requires them as the DTO seam.
- **`ItemRepository` has no `delete`**, though `Deletable` / `ScopedDeletable` exist.
- **No deployment**: no container, no release-step migration, no e2e target.

## Decisions taken

| # | Decision | Recorded in |
| --- | --- | --- |
| 1 | Done = Free tier over HTTP; Pro stays domain-only | this file |
| 2 | Managed identity broker; local `User` mirrors it; JIT provisioning with drift re-sync | ADR-0032 |
| 3 | `provider` holds the social connection, `providerId` the broker subject; unique email index kept | ADR-0032 |
| 4 | `libs/authorization` loads owned entities and mints `UserAuthorized` bundles | ADR-0031 |
| 5 | Item creation stays synchronous for v1; async is a later, additive change | this file |
| 6 | Request validation: zod schemas in `data` libs, `createZodDto` wrappers in `apps/api`, one global pipe | this file |
| 7 | Every response is enveloped: `{ status, data }` / `{ status, error }` | this file |
| 8 | Controllers return `Result`; a per-controller failure interceptor maps `ServiceFailure` to `HttpException` with a user-facing message; a global filter builds the envelope | this file |
| 9 | Error bodies carry no failure tag, no metadata, no cause chain in production | this file |
| 10 | Logging at the edge only, with `libs/extraction` the one exception; `nestjs-pino` | this file |
| 11 | Long-running container; migrations as a release step; env validated once at bootstrap with zod | this file |
| 12 | `libs/<feature>/data` libs created per slice | this file |
| 13 | Firebase Authentication is the broker; lookup by `providerId` alone, `provider` re-synced as drift | ADR-0034 |
| 14 | HTTP edge in `@wish-list/common-http`: `nestjs-zod` pipe, per-tag defaults with `@FailureResponses` map or `FailureTranslator` overrides, `HTTP_EXPOSE_FAILURES` for dev | ADR-0036 |
| 15 | `unauthenticated` (401) and `user-deactivated` (403) join `ServiceFailureType`; one generic 401 message, reason in metadata, logged by the guard, `WWW-Authenticate: Bearer` | ADR-0037 |
| 16 | `Identity` in `libs/domain`; token verification in horizontal `libs/authentication`; `AccountService.resolve` in `libs/account/service`; global `AuthGuard` + `@CurrentUser()` in `apps/api`, `@Public()` opt-out | ADR-0038 |
| 17 | `AuthGuard` refuses a Deactivated `User` (403 `user-deactivated`) unless the route is `@AllowDeactivated()` (built in M1 with reactivate); `Authorization`'s check stays | ADR-0039 |
| 18 | `Identity.name` is `Option`; missing name falls back to the email local part; `User.nameSource` (`broker`/`user`) stops re-sync once the User renames | ADR-0040 |

Glossary changes made alongside: **Identity** added; **Status (of a User)** corrected
(deactivation refuses requests, it does not block login); **Extraction Status** reworded so
Pending is a state an Item holds rather than a promise about when the reading happens.

### Failure to status code

| tag | code |
| --- | --- |
| `invalid` | 400 |
| `unauthenticated` | 401 |
| `forbidden` | 403 |
| `user-deactivated` | 403 |
| `plan-required` | 403 |
| `not-found` | 404 |
| `conflict` | 409 |
| `unexpected` | 500 |

`user-deactivated` is 403 rather than 401: the token is valid, the account is refused.

## M0 — API shell

A walking skeleton: sign in, create a wishlist, see it back. Proves auth, logging, the
envelope and deployment against real traffic before six service libs are built on top.

1. `apps/api` scaffold — Nest application, zod-validated env, composition of
   `DatabaseModule` / `ExtractionModule` via their existing `ConfigurableModuleBuilder`
   options, health endpoint.
2. Logging — `nestjs-pino`, `AsyncLocalStorage` request context, request id accepted or
   generated and echoed in the response header, `PinoFailureRenderer implements
   FailureRenderer`, email and auth headers redacted.
3. HTTP edge — global zod validation pipe, `ResponseInterceptor` (`{ status: 'success' |
   'created', data }`), global `FailureFilter` (`{ status: 'error', error }`). Deletes
   return 200 with `data: null`; 204 never appears, so the envelope has no hole.
4. Auth — broker JWT guard with cached JWKS, `CurrentUser` decorator,
   `libs/account/service` with `resolve(identity)`: find by (provider, providerId), else
   create `User` + Unsorted Category in one transaction; re-sync name and email on drift.
5. `libs/authorization` — `EntityAuthorizer` over the owned-entity registry (ADR-0031).
6. First vertical — `libs/wishlist/data` + `libs/wishlist/service` + controller for
   `POST /wishlists` and `GET /wishlists`. `GET` is a collection read, so it uses
   `QueryScope.user` and never touches the authorizer; `POST` creates an entity that has no
   owner to check yet. Together they exercise the shell without needing seed data.
7. Deployment — container image, release-step `drizzle-kit migrate`, staging environment.

## M1 — Free tier breadth

1. **item** — `POST /wishlists/:id/items` on the existing `ItemService.create`, the first
   real two-member bundle (`{ wishlist, category }`). Then list, get, update, delete, move
   between wishlists, mark fulfilled, re-extract.
   *Blocked on*: transitive Item ownership (`authorizeVia`, deferred by ADR-0030) and
   `ItemRepository.delete`. Both land here.
2. **category** — CRUD, with Unsorted protected from rename and delete, and a decision on
   what happens to Items in a deleted Category (reassign to Unsorted is the only option
   consistent with "an Item is never categoryless").
3. **wishlist** — the rest: rename, delete, publish, unpublish, rotate slug, surprise mode.
4. **account** — `GET /me`, deactivate, reactivate.
5. **coupon** — CRUD only. Matching and Effective Price are Coupon Rule behaviour and
   therefore Pro. A Coupon cannot attach to a provisional Vendor (ADR-0022).
6. **sharing** — `GET /s/:slug`, unauthenticated, published wishlists only, Reservations
   absent because they are Pro.

## M2 — Hardening, then Pro

- OpenAPI from the zod schemas, e2e suite against a real Turso instance, CORS, security
  headers, rate limiting (the extraction endpoint especially — it spends money per call).
- Async extraction: insert Pending, extract in-process, boot-time and periodic sweeper
  re-dispatching Items stuck Pending. `extraction_status` is the work record, so no broker
  is needed; ADR-0023's append-only log already makes retries traceable.
- Pro: Subscription concept, then Coupon Rule engine, Reservations (ADR-0015's token
  cancel mechanism), Tracked Items and the daily price fetch.

## Open questions

- ~~Which broker.~~ Resolved: Firebase Authentication (ADR-0034). Changes ADR-0032's lookup
  key to `providerId` alone, which needs a unique index on `users.provider_id` in M0 step 4.
- `authorizeVia`'s exact shape for transitive Item ownership — designed in M1, its loading
  half in `libs/authorization`, its checking half in `libs/domain`.
- Whether `libs/authorization`'s registry batches its reads once bundles exceed two members.
- Deleting a Category: reassign Items to Unsorted, or refuse while non-empty.

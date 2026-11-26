# Infisical is the single source of secrets

M0 step 7b. The API reads its configuration from `process.env`, validated once by
`Env.$` at boot (roadmap decision #11). Today the values come from a
hand-written `apps/api/.env` that exists only on one machine. Staging and production
need the same keys with different values, CI will need some of them in 7d, and nothing
records which values each environment has.

There is also a gap. `libs/database/drizzle.config.ts` passes `DATABASE_AUTH_TOKEN` to
drizzle-kit, but the API never reads it: `Env.$` has no such key and `DatabaseModule` takes
only `{ url }`. Against a local `file:` database that goes unnoticed. Against a remote
`libsql://` Turso database every query would be refused.

**Infisical Cloud holds every secret for every environment. One project, `wishlist-api`,
has three environments, Development (`dev`), Staging (`staging`) and Production (`prod`),
with every key at the root path. Locally, the API runs under `infisical run`, which
injects the secrets as environment variables. `apps/api/.env` is no longer used. The app's
loading code does not change. `DATABASE_AUTH_TOKEN` joins `Env.$` and `DatabaseModule`,
and it is required whenever `DATABASE_URL` is remote.**

```sh
infisical login      # once per machine
npm start            # infisical run -- nx serve api (dev, from .infisical.yaml)
npm run db:migrate   # infisical run -- nx run database:db:migrate
infisical run --env=staging -- npx nx run database:db:migrate
```

- **The loader is untouched.** `EnvModule` merges a `.env` file into `process.env` with
  real environment variables winning, and a missing file is not an error. `infisical run`
  sets real environment variables, so it works with no code change. A `.env` that someone
  creates by hand still works, which is useful offline, but it is no longer the documented
  way.
- **`.infisical.yaml` is committed.** `infisical init` writes it with the project id and
  the default environment (`dev`). The id identifies the project and grants nothing.
  Access comes from `infisical login`, so the file is safe in the repository.
- **`.env.example` stays** as the list of keys and what each one means. It is the
  reference for what to create in each Infisical environment, and `Env.$` remains the
  authority on what is required.
- **Keys sit at the root path, not in an `/api` folder.** The free plan allows one
  organisation, so the project itself is named after the app (`wishlist-api`). A future
  `apps/web` gets its own project, which keeps the API's secrets out of any browser build.
- **`DATABASE_AUTH_TOKEN` is optional, except for remote URLs.** A `file:` URL needs no
  token. A `libsql://` or `https://` URL without one fails `Env.$` at boot, rather than
  failing on the first query. `DatabaseModuleOptions` gets `authToken: Option<string>`,
  and `createDatabaseClient` passes it to `createClient`.

## Per-environment values

| key                    | dev                  | staging                      | prod                      |
| ---------------------- | -------------------- | ---------------------------- | ------------------------- |
| `DATABASE_URL`         | `file:./local.db`    | Turso `libsql://` staging DB | Turso `libsql://` prod DB |
| `DATABASE_AUTH_TOKEN`  | —                    | staging DB token             | prod DB token             |
| `FIREBASE_PROJECT_ID`  | `wishlist-porto-dev` | dev project for now          | its own project, later    |
| `LOG_PRETTY`           | `true`               | `false`                      | `false`                   |
| `HTTP_EXPOSE_FAILURES` | `true`               | `true`                       | `false`                   |

Staging exposes failures (amended 2026-11-26): it exists for testing, and a 4xx/5xx body
that carries the failure chain saves a trip to the logs. Its bodies then include stack
traces with bundle paths. That's acceptable for a testing environment holding no real
user data, and never for production.

The other keys (`LLM_*`, `LOG_LEVEL`, the extraction tunables) hold the same meaning
everywhere and are set per environment as needed. Production is created now and stays
empty until there is something to deploy there.

## Considered options

- **Hand-written `.env` per machine, platform secrets per host** (the status quo,
  rejected). Values live in as many places as there are environments, nothing shows what
  staging actually runs with, and rotating a key means visiting each place.
- **GitHub Actions secrets as the store** (rejected). They are write-only from the UI,
  scoped to CI, and useless for local development.
- **Infisical with an `/api` folder in a shared project** (rejected). It separates apps by
  path, but the free plan's single organisation makes a project per app the clearer
  boundary.
- **Infisical, one project per app, keys at the root** (chosen).

## Consequences

- **Every developer needs an Infisical account** and access to `wishlist-api`. There is
  one developer today.
- **Local dev depends on Infisical being reachable** at startup. A hand-written `.env`
  remains the offline fallback.
- **CI still holds no secrets (ADR-0044).** How the running container gets its secrets
  depends on the host and is decided in 7d. Amended by ADR-0047: Infisical's Railway sync
  delivers them, so no GitHub OIDC identity is created and CI never reads Infisical.
- **`apps/api/.env` is deleted** once its values are in Infisical's `dev` environment.
  `.gitignore` keeps ignoring `.env*`.

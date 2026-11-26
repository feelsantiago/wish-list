# The API image packages the Nx prune output and carries its own migrator

M0 step 7c. Roadmap decision #11 settled a long-running container with migrations as a
release step. This ADR settles what goes into the image, how it is built, and where it is
published. The host, and how the container receives its secrets, are left to 7d.

`api:build` already produces a bundle that includes every `@wish-list/*` lib. `api:prune`
adds a `package.json` and `package-lock.json` limited to what the API needs, plus
`workspace_modules/` holding each workspace lib's own `package.json`, so a plain `npm ci`
can resolve the libs' third-party dependencies (`@libsql/client`, `ai`, `cheerio`,
`jose`, …). Tried standalone, `npm ci --omit=dev` in `apps/api/dist` installs 220
packages, and `node main.js` boots as far as env validation.

**Nx builds and Docker only packages. `apps/api/Dockerfile` starts from
`node:24-slim`, copies the `api:prune` output, runs `npm ci --omit=dev`, and starts
`node main.js` as the non-root `node` user. The image also contains a second entry,
`migrate.js`, which applies the `drizzle/` SQL migrations with
`drizzle-orm/libsql/migrator`. CI builds the image on every push to `main` after `check`
passes, and pushes it to GHCR.**

```dockerfile
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY workspace_modules ./workspace_modules
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY . .
USER node
EXPOSE 3000
CMD ["node", "main.js"]
```

- **The build context is `apps/api/dist`, not the repository root.** Docker only ever sees
  the prune output, so `.env` files, `.infisical.yaml`, `local.db` and the Nx cache
  cannot reach the image, and no `.dockerignore` is needed to keep them out.
- **Dependencies are installed before the bundle is copied**, so changing code without
  changing dependencies reuses the cached `npm ci` layer.
- **An `api:docker-build` Nx target** depends on `api:prune` and runs
  `docker build -f apps/api/Dockerfile apps/api/dist`, so one command builds the image
  locally, and CI calls the same target.
- **`NODE_ENV` belongs to the image**, not to Infisical. Infisical holds configuration
  that varies by environment; how the bundle runs does not.

### The migrator

- **`apps/api/src/migrate.ts`** is a second webpack entry (`additionalEntryPoints`). It
  validates only `DATABASE_URL` and `DATABASE_AUTH_TOKEN` (the same rules as `Env.$`, so
  a remote URL still requires the token), runs the migrations, logs what was applied, and
  exits non-zero on failure.
- **The migration logic lives in `libs/database`**, as `Database.migrate(db, folder)`
  returning an `AsyncResult`. The lib owns the schema and the migration files, so it also
  owns applying them. The entry only wires env to it.
- **`libs/database/drizzle/` is copied into the bundle** as `drizzle/` by the webpack
  `assets` option, so the image does not depend on the layout of `workspace_modules`.
- **drizzle-kit stays a dev tool.** It still generates migrations, and `npm run
db:migrate` still applies them locally. Both write to the same `__drizzle_migrations`
  table, so a database migrated by one is up to date for the other.

### Publishing

- **Registry: GHCR**, `ghcr.io/feelsantiago/wish-list-api`, pushed with the workflow's
  `GITHUB_TOKEN` (`packages: write` on that job only). No extra secret is needed.
- **Tags:** `sha-<short sha>`, which never moves and is what 7d deploys, and `main`,
  which moves with each push. No `latest`.
- **Platform:** `linux/amd64` only. That is what hosts run. A local build on an arm64 Mac
  produces an arm64 image, which is fine for trying it out.
- **The `image` job** runs only on `push` to `main`, with `needs: check`. Pull requests
  build nothing.

## Considered options

- **Multi-stage Dockerfile that runs `npm ci` and `nx build` itself** (rejected). It is
  self-contained, but it installs every dev dependency on every build, cannot use the Nx
  cache, and repeats work `check` has just done.
- **Distroless `nodejs24`** (rejected for now). It has a smaller attack surface, but no
  shell to exec into while staging is still being set up. It is a one-line change later,
  because the runtime needs nothing from the shell.
- **`node:24-alpine`** (rejected). The smallest base, but musl means relying on libsql's
  musl binary, which has seen fewer deployments.
- **drizzle-kit in the image** (rejected). It ships a dev tool and its dependencies to
  production to do what drizzle-orm's migrator already does.

## Consequences

- **The image is roughly 75 MB of base plus about 110 MB of `node_modules`.**
  `workspace_modules` also copies each lib's sources (about 8 MB), which the runtime never
  reads. Trimming that is possible but not worth a custom prune step yet.
- **Migrations are part of the image's version.** The `sha-…` tag that runs the code also
  carries exactly the migrations that code expects, so 7d's release step and the deploy
  that follows always agree.
- **`npm ci` runs inside the image build on Linux**, so it resolves libsql's
  `linux-x64-gnu` binary from the lockfile, not the macOS one used locally.
- **No `HEALTHCHECK` in the image.** Hosts probe `/api/health` themselves, and 7d
  configures that.
- **Building the image needs a Docker daemon.** CI runners have one. Locally it means
  Docker Desktop (or an equivalent) running.

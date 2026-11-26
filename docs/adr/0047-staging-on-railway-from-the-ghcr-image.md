# Staging runs on Railway from the GHCR image, with secrets synced by Infisical

M0 step 7d. The API image is built once per push to `main` and published as
`ghcr.io/feelsantiago/wish-list-api:sha-<short>` (ADR-0046). It carries `migrate.js` for
the release step. Secrets live in Infisical (ADR-0045). What's left is where the container
runs, how it gets its secrets, how migrations run before traffic moves, and how CI
triggers all of that.

**Railway (Hobby plan) hosts the API. A `wish-list` project has a `staging` environment
now and a `production` environment later, each with one API service (`wish-list-api`) whose source is the
public GHCR image. Railway runs `node migrate.js` as the pre-deploy command and switches
traffic only after `/api/health` answers 2xx. Infisical's native Railway sync pushes
each Infisical environment into the matching Railway environment. CI never reads
secrets. On every push to `main`, after `image`, a `deploy-staging` job points the
staging service at the new `sha-<short>` tag.**

```
push to main
  └─ check ─ image (ghcr.io/…/wish-list-api:sha-abc1234)
               └─ deploy-staging: railway → staging/wish-list-api → image sha-abc1234
                    ├─ pre-deploy: node migrate.js   (non-zero → deploy stops)
                    ├─ start: node main.js
                    └─ /api/health 2xx → traffic moves; else old deploy stays
Infisical staging ──sync──▶ Railway staging/wish-list-api variables
```

### The image is public

- Railway pulls private registry images only on the Pro plan. The repository is public,
  and the image holds nothing the repository doesn't: the bundle, its source maps and
  the SQL migrations. No secret is baked in (ADR-0046 keeps `.env` and `.infisical.yaml`
  out of the build context). So the GHCR package is made public, and Railway pulls it
  without credentials.
- If the repository ever goes private, the image must go private too, which means
  Railway Pro and a `read:packages` token.

### Secrets: Infisical syncs, CI stays out

- **One Infisical secret sync per environment.** Source: the `wishlist-api` project,
  environment `staging`, path `/`. Destination: Railway project `wish-list`, environment
  `staging`, service `wish-list-api`. Auto-sync is on, so a change in Infisical reaches Railway
  without a commit.
- **The sync authenticates with a Railway project token** scoped to that environment,
  which is the narrowest token Railway offers.
- **`PORT` is not synced.** Railway injects `PORT` and routes to it, and `Env.$` already
  reads it. A `PORT` from Infisical would override that. It stays in Infisical's `dev`
  environment only.
- **`NODE_ENV` is the image's** (ADR-0046) and is not in Infisical at all.
- **The planned GitHub OIDC identity is dropped.** ADR-0045 deferred it to this step for
  CI to read Infisical. With the sync, CI never needs to.
- **A changed secret takes effect on the next deploy.** Railway applies variable changes
  by redeploying. A secret rotated in Infisical is live after the following deploy, or
  after a manual redeploy from the dashboard.

### Deploying from CI

- **`deploy-staging`** runs only on `push` to `main`, with `needs: image`, in a GitHub
  Environment named `staging`. That gives the deploy its own history in GitHub and keeps
  the Railway token out of pull request runs.
- **It calls Railway's GraphQL API through `railway api`.** It resolves the environment
  and service IDs from their names, then calls `environmentPatchCommit` with
  `{services: {<id>: {source: {image: <ref>}}}}` and the message `Deploy <ref>`. That
  writes the `sha-<short>` image into the environment's configuration and starts exactly
  one deploy.
- **Two CLI commands were tried first and failed:**
  - `railway service source connect --image`, followed by `railway service redeploy`.
    `connect` started a deploy without changing the configured image (it stayed `:main`).
    The redeploy started a second deploy, whose pre-deploy migration raced the first
    (`table categories already exists`).
  - `railway environment edit --service-config <service> source.image <ref>`. It exits 0
    and reports "No changes to apply" when stdin isn't a terminal, which is always the case
    in CI.
- **The job waits for the outcome.** It polls `railway deployment list` for the deployment
  whose `meta.image` is the pushed tag, and passes only on `SUCCESS`. It fails on
  `FAILED`, `CRASHED`, `REMOVED` or `SKIPPED`, or after 15 minutes. A green job therefore
  means the migrations ran and `/api/health` answered, not only that Railway accepted the
  request.
- **The token is a Railway account token**, stored as the GitHub Environment secret
  `RAILWAY_API_TOKEN` on `staging`, never as a repository-wide secret. A project token
  scoped to `staging` was tried first: it finds the service but is refused
  (`Unauthorized`) when `source connect` changes the image. An account token reaches
  every project on the account, which is broader than this job needs. That's the price
  of setting the image from CI. The project ID and the service name are the Environment
  variables `RAILWAY_PROJECT_ID` and `RAILWAY_SERVICE`. Railway names a service created
  from an image after the image (`wish-list-api`), so the workflow reads the name instead
  of assuming one. A missing value fails the job by name before the CLI runs, because the
  CLI reports an empty project as `Unauthorized`.
- **The job deploys the exact tag `image` pushed**, never `main`. Railway's own
  auto-update on a moving tag isn't used: it polls on its own schedule, and the deploy
  would no longer be tied to the commit that triggered it.

### Service settings live in Railway

Railway's config-as-code file is deprecated (legacy services keep it until 2026-12-01),
so these are set once in the dashboard and recorded here:

| setting             | value                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| Source              | Docker image `ghcr.io/feelsantiago/wish-list-api:<tag>` (CI sets the tag) |
| Pre-deploy command  | `node migrate.js`                                                         |
| Start command       | image default (`node main.js`)                                            |
| Healthcheck path    | `/api/health`                                                             |
| Healthcheck timeout | default (300 s)                                                           |
| Replicas            | 1                                                                         |

### Target: pull requests on staging, `main` on production

For now, `main` deploys to staging. The target workflow, once production exists, is that
**a pull request deploys to staging for testing, and merging to `main` deploys to
production**. There is one pull request open at a time, so staging is a single slot. The
pieces built now are shaped for that:

- **The deploy is one reusable job** taking the Railway environment and the image tag.
  Today it's called once (`main` → `staging`). Later: pull request → `staging`, `main` →
  `production`. Production keeps build once, promote: it runs a `sha-<short>` image that
  staging already ran, and only the Infisical environment differs.
- **Pull requests get images too.** The `image` job also runs on `pull_request`, tagging
  `pr-<number>` alongside `sha-<short>`. The deploy still uses the `sha-` tag.
- **Only same-repository pull requests deploy.** The repository is public. GitHub
  withholds secrets and package write access from pull requests opened from forks, and
  the deploy and image jobs say so explicitly with an `if:` on the head repository,
  instead of failing.
- **Staging deploys are serialized** with a `deploy-staging` concurrency group. A newer
  push replaces the run that is waiting.
- **Closing a pull request puts staging back on `main`.** Merged or not, staging returns
  to the latest `main` image, so it never keeps running abandoned code.
- **A pull request's migrations land in the shared staging database and stay there.**
  drizzle can't roll them back. If the pull request merges, nothing is lost. If it's
  abandoned with a migration, the staging database is reset: drop it, then migrate from
  `main`. Staging data is disposable, and one pull request at a time keeps this rare.
  The reset is a manual step until it becomes frequent.

## Considered options

- **Fly.io** (rejected by preference). `release_command` fits migrations just as well,
  but it is pay-as-you-go and needs more setup.
- **Google Cloud Run** (rejected). It runs only while handling requests unless you pay
  for always-on instances, which works against M2's in-process extraction sweeper.
- **Render** (rejected). Its free tier sleeps, and the pre-deploy command is paid-only.
- **Railway Pro with a private image** (rejected). $20/month and a long-lived
  `read:packages` token, to hide an image whose source is already public.
- **Railway builds from source (`railway up`)** (rejected). Production would run a
  different build from the one staging tested, and the GHCR job would be redundant.
- **CI pushes secrets through GitHub OIDC** (rejected). Secrets would pass through the
  runner, and CI would need Infisical access, to do what Infisical's sync already does.

## Consequences

- **Cost:** Railway Hobby is $5/month and includes $5 of usage, which covers one small
  staging service.
- **Some configuration isn't code.** The Railway service settings and the Infisical sync
  live in two dashboards. The table above is the record, and a change there should update
  this ADR.
- **This amends ADR-0045**: no GitHub OIDC identity, and container secrets come from the
  sync.
- **Migrations run before every deploy.** `migrate.js` is a no-op when the database is up
  to date, so a deploy with no new migrations pays only a short connection.
- **A failed migration leaves the previous deploy serving, on an unchanged schema.**
  drizzle-orm's libsql migrator sends every pending statement, with its
  `__drizzle_migrations` rows, as one `client.migrate` batch, which libsql applies as a
  single transaction. A failure rolls back all of it, so the old code keeps running
  against the schema it expects.
- **Migrations must stay backward compatible for one deploy.** The pre-deploy command
  runs while the previous version still serves traffic, so a migration can't drop or
  rename something the running code still uses. Removals take two deploys: stop using it,
  then drop it.

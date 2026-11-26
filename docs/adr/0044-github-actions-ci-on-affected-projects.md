# CI runs on GitHub Actions over affected projects, without Nx Cloud

M0 step 7 introduces deployment, and it is split into four sub-steps: **7a** CI, **7b**
secrets (Infisical), **7c** the container image, and **7d** deploying to staging. This ADR
covers 7a. Later sub-steps add jobs to the same workflow, so 7a fixes the workflow's shape.

`.github/workflows/ci.yml` already exists. The Nx workspace generator created it, and it is
green. But most of it does nothing:

- `nx start-ci-run`, `nx record` and `nx fix-ci` call Nx Cloud. The workspace was never
  connected (`nx.json` has no `nxCloudId`), so each logs "Nx Cloud is not enabled" and
  exits.
- `run-many -t lint test build typecheck e2e` runs every target on every project on every
  push. No project has an `e2e` target.
- Node is pinned to 24 only inside the workflow. Nothing pins it locally.

**One workflow, `ci.yml`, runs on every pull request and every push to `main`. It checks
formatting, then runs `lint`, `typecheck`, `test` and `build` on affected projects only.
Nx Cloud is not used, and the Nx cache is not carried between runs.
Node 24 LTS is pinned once in `.nvmrc`, and CI and `engines` follow it.**

```yaml
on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.event_name }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

permissions:
  contents: read
  actions: read # nx-set-shas reads previous workflow runs

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0, filter: tree:0 }
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - uses: nrwl/nx-set-shas@v4
      - run: npx nx format:check --all
      - run: npx nx affected -t lint typecheck test build
```

- **Affected, not run-many.** `nrwl/nx-set-shas` sets the base for each event. A pull
  request compares against the merge base with `main`. A push to `main` compares against
  the last commit whose CI run succeeded, so a red commit's changes are checked again on the
  next push instead of being skipped.
- **No Nx cache between runs** (amended 2026-11-26). The first version persisted
  `.nx/cache` with `actions/cache`. It never produced a hit: Nx 23 records cache entries in
  a SQLite database under `.nx/workspace-data/`, keyed by machine ID, and refuses
  artifacts it has no record of ("Unrecognized Cache Artifacts"). Every GitHub runner is
  a new machine, so caching the database too would not help, and
  `NX_REJECT_UNKNOWN_LOCAL_CACHE=0` is no longer honoured. A remote cache (Nx Cloud, or a
  self-hosted server implementing Nx's cache API) is the only way to share it, which is
  more than this workspace needs today. `setup-node` still caches npm downloads.
- **Concurrency cancels superseded pull request runs only.** A run on `main` always
  finishes, because 7c and 7d will deploy from it. Pull request runs are grouped by
  pull request number, pushes by ref (amended 2026-11-26). The first version grouped
  everything by `github.ref`. When a pull request is merged, its `closed` run gets
  `github.ref = refs/heads/main`, so it joined `main`'s group and cancelled the push run
  the merge had started (PR #1).
- **CI holds no secrets.** Tests run against the local test harness and never reach Turso,
  Firebase or the LLM. That stays true: a test that needs a real secret belongs in the M2
  e2e suite, not in this job.
- **`check` is the required status check** on `main`, set in branch protection. 7c and 7d
  add jobs with `needs: check` that run only on `push` to `main`.

## Considered options

- **Keep the generated workflow** (rejected). It passes, but three of its steps do nothing,
  it runs every target on every push, and its unused `e2e` target hides the fact that no
  e2e suite exists.
- **Connect Nx Cloud** (rejected). Remote caching shared between local and CI, plus
  distributed agents and self-healing CI. With 13 projects a full run takes about a minute,
  so there is nothing to distribute. It also adds an external account and sends cache
  artifacts out of GitHub. It can be reconsidered when CI time becomes a problem, and doing
  so is an additive change.
- **`run-many` on everything, without a cache** (rejected). Simple, but CI time grows with
  the workspace instead of with the change.
- **Affected plus `actions/cache` on `.nx/cache`** (tried, then removed). See the
  amendment above: Nx 23 cannot restore artifacts from another machine.
- **Affected, no cross-run cache** (chosen). Uses only GitHub and Nx, and CI time stays
  proportional to the change.

## Consequences

- **`.nvmrc` (`24`) is the one place Node is pinned.** `package.json` gets
  `engines.node: ">=24 <25"`. The 7c container image uses the same major version.
  Upgrading Node means changing `.nvmrc` and the base image in the same commit.
- **`format:check` covers the whole workspace**, not just affected files. Prettier is fast
  enough that this costs nothing, and it catches files that belong to no project.
- **An affected run can skip a broken project.** If a change outside a project's inputs
  breaks it (for example a root config that isn't in `sharedGlobals`), affected won't
  select it. The fix is to add that file to `sharedGlobals` when it happens, not to fall
  back to `run-many`.
- **Branch protection is manual.** It is a repository setting, not code, so this ADR records
  it and the step's checklist includes it.

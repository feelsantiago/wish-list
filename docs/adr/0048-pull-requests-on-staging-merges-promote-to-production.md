# Pull requests deploy to staging; merging promotes the tested image to production

M0 shipped `main` → staging (ADR-0047). ADR-0047 also set the target: **a pull request
deploys to staging for testing, and merging to `main` deploys to production**, with one
pull request open at a time. This ADR settles how `main` is protected, how a pull request
reaches staging, and how production gets an image. Production's own resources (its Turso
database, Infisical values and Railway setup) are step 8c and are decided separately.

**`main` only changes through squash-merged pull requests that are up to date with `main`
and have passed CI. Every push to a pull request builds an image tagged with the pull
request's head commit and deploys it to staging. Merging builds nothing. CI finds the
merged pull request, takes the image of its last head commit (the one staging ran), and
deploys that exact image to production.**

```
pull request (head abc1234)
  push ─ check ─ image sha-abc1234 ─ deploy-staging          ← you test here
  close ─ restore-staging: staging back on production's image

merge (squash) → main (commit def5678)
  push ─ check ─ promote: PR of def5678 → head abc1234 → sha-abc1234
                  └─ deploy-production: sha-abc1234           ← no rebuild
```

### `main` is protected (8a)

A ruleset on `main`, set in GitHub (repository settings, not code):

| rule                              | value                                                    |
| --------------------------------- | -------------------------------------------------------- |
| Require a pull request            | yes, 0 approvals (one developer can't approve their own) |
| Required status checks            | `check`, `deploy-staging / deploy`                       |
| Require branches to be up to date | yes                                                      |
| Block force pushes and deletion   | yes                                                      |
| Allowed merge method              | squash only                                              |
| Bypass                            | repository admin, for emergencies only                   |

- **Requiring the staging deploy** means a pull request can't merge until its image has
  deployed to staging and passed migrations and `/api/health`. So the image production
  will promote is known to exist and to have run.
- **Up to date with `main`** makes the pull request head contain everything on `main`, so
  the squashed commit has exactly the head's code. That is what makes promoting the head's
  image correct. With one pull request at a time, `main` only moves when that pull request
  merges, so "Update branch" is rarely needed. When it is, GitHub's button does it, and
  the new head deploys to staging again.
- **Squash only** gives one commit per pull request on `main`, titled by the pull request.
  The reviewed step commits stay readable inside the pull request.
- Branches are deleted automatically after merging.

### Pull requests deploy to staging (8b)

- **Triggers:** `pull_request` for `opened`, `synchronize`, `reopened` and `closed`.
  `check` runs as before.
- **The image is built from the head commit, not the merge preview.** On `pull_request`,
  GitHub checks out a temporary merge commit by default. The `image` job checks out
  `github.event.pull_request.head.sha` and tags `sha-<head short>` and `pr-<number>`. The
  `sha-` tag is what deploys use and what production later promotes.
- **Only pull requests from this repository build and deploy.** The repository is public.
  For a fork's pull request, GitHub gives no secrets and no package write access, so the
  `image` and deploy jobs are skipped by an explicit `if:` instead of failing. `check`
  still runs. GitHub counts a skipped required check as passed, so a fork's pull request
  could merge without ever reaching staging. Such a change is pushed to a branch here
  first, and merged from there.
- **Closing a pull request, merged or not, puts staging back on production's image.** A
  `restore-staging` job reads the image configured in Railway's `production` environment
  and deploys it to staging with the same deploy workflow. Until production exists (8c),
  there's nothing to restore to, and the job logs that and exits.
- **Staging deploys are serialized** (ADR-0047's `deploy-staging` concurrency group). A
  newer push replaces a waiting run.
- **An abandoned pull request's migrations stay in the staging database** (ADR-0047).
  If one was applied, reset staging before the next pull request. That's a manual step
  for now.

### Merging promotes to production (8c wires the environment)

- **On `push` to `main`**, after `check`, a `promote` job calls
  `GET /repos/{owner}/{repo}/commits/{sha}/pulls`. It takes the merged pull request's
  `head.sha` and checks that `sha-<head short>` exists in GHCR. A missing image fails the
  job: required checks should have made that impossible.
- **`deploy-production`** calls the same reusable deploy workflow with
  `environment: production` and that image. The GitHub Environment `production` holds its
  own Railway token and IDs, and has no required reviewers: merging the pull request is
  the approval.
- **A push to `main` with no pull request** (an admin bypass) has no tested image. The
  `promote` job then builds one from `main`, as the `image` job does today, and deploys
  it, and the run says it deployed an untested build.
- **The `main` tag follows production.** After a successful production deploy, the
  promoted image is also tagged `main` (`docker buildx imagetools create`, no rebuild).
  So `main` always names what production runs.

## Considered options

- **Rebuild on `main`** (rejected). Simpler: the merge builds a fresh image and deploys
  it. But production would run a build staging never ran, so a staging test would only
  vouch for the same source, not the same artifact.
- **Rebase or merge commits** (rejected). Both work with promotion, since the image is
  found through the pull request. Squash keeps `main` to one commit per change.
- **Require approvals** (rejected). With one developer, GitHub doesn't let you approve
  your own pull request, so any approval requirement means bypassing every time.
- **Manual approval on the `production` environment** (rejected for now). Merging is
  already a deliberate act. A second click adds nothing while one person does both.

## Consequences

- **This amends ADR-0047**: staging is driven by pull requests, not `main`, and the
  `main` tag means "what production runs", not "latest build".
- **This amends ADR-0046**: the `image` job runs on same-repository pull requests and
  tags `sha-<head>` and `pr-<number>`. On `main`, it only runs when there's no pull
  request to promote.
- **Direct pushes to `main` stop**, including docs-only changes. Every change, even a
  typo fix, goes through a pull request and a staging deploy.
- **Production runs exactly what staging ran**, down to the image digest. Only the
  Infisical environment differs.
- **Staging is always either the open pull request or production**, never stale code
  from an abandoned branch. Its database is the exception: migrations can't be rolled
  back.

# A missing name falls back to the email's local part; an edited name is never re-synced

`User.name` is required (`z.string().min(1)` in PRD-0003, `users.name NOT NULL`), and
ADR-0032 re-syncs it from the broker on every resolve. Firebase fills the `name` claim from
the provider profile. Google almost always has one; GitHub's profile name is optional, and
when it is empty the claim is absent. The GitHub username is not in the ID token at all, so
the API cannot fall back to it. ADR-0038 left this open.

Users will also be able to change their name in the app. A blind re-sync would overwrite
that edit on their next sign-in.

**`Identity.name` is an `Option<string>` holding what the broker reported. `User` gains a
`nameSource: 'broker' | 'user'` field, and `AccountService.resolve` applies these rules:**

| case | broker reports a name | broker reports none |
| --- | --- | --- |
| first sign-in (create) | store it, `nameSource: 'broker'` | store the email's local part (`jane.doe@x.com` → `jane.doe`), `nameSource: 'broker'` |
| returning, `nameSource: 'broker'` | re-sync it if it differs | keep the stored name |
| returning, `nameSource: 'user'` | keep the stored name | keep the stored name |

A fallback name counts as `'broker'`, so a GitHub user who later sets a profile name gets it
on their next sign-in. Renaming in the app goes through a domain `User.rename(user, name)`,
which applies `User.$`'s non-empty rule and sets `nameSource: 'user'`. From then on the broker
never touches the name.

`email` and `provider` keep ADR-0032's unconditional re-sync. Email is required (ADR-0034),
so it never needs a fallback, and neither field is user-editable.

## Considered options

- **Refuse the sign-in with 401 `missing-name`** (rejected). It mirrors `missing-email`, but
  it locks out every GitHub user without a profile name over a field nothing reads yet.
- **A fixed placeholder such as "Wishlist user"** (rejected). Never empty and leaks nothing,
  but it carries no meaning. The local part at least tells a user, or a support view, whose
  account it is.
- **Make `User.name` optional** (rejected). The most honest model, because it never invents
  a name. But it changes the entity, the schema, the mapper and PRD-0003, and moves the
  fallback into every place that shows a name.
- **A separate `displayName: Option<string>` beside a broker-owned `name`** (rejected). The
  broker name keeps syncing and "go back to my provider name" is just clearing a field. But
  every reader has to remember to coalesce two fields. It also keeps storing a profile name
  the user replaced and nobody shows, which is personal data held for no purpose.
- **One `name` with a `nameSource` marker (chosen).** One field to read. The marker says
  only who wrote the name last, which is exactly what re-sync needs to know.

## Consequences

- **Migration: `users.name_source TEXT NOT NULL DEFAULT 'broker'`.** It lands with ADR-0034's
  `provider_id` unique index, as one M0 step 4 migration.
- **`libs/domain` changes:** `Identity.name` is an `Option<string>`, `User` gains
  `nameSource`, and `User.rename` is added. `User.create` sets `'broker'`, since every
  account starts from a sign-in. PRD-0003's field list is superseded on this one point.
- **Renaming is an M1 account endpoint** (`PATCH /me` or similar). It is not built in M0;
  only the field and the domain function land now, so `resolve` can respect them.
- **No "use my provider name again" action yet.** If one is wanted later, it sets
  `nameSource` back to `'broker'` and the next sign-in re-syncs. No schema change is needed.
- **The share page must not assume `name` is a real name.** For a broker-sourced name it may
  be the local part of the owner's email. When M1 Sharing decides whether public pages show
  the owner, it has to account for that: anonymous by default, or shown only for
  `nameSource: 'user'`.
- **ADR-0038's last open item is closed.**
- **Where the rules are written (amended during M0 step 4).** The table's rules live in
  `libs/domain` as pure functions, not inside `AccountService.resolve`:
  `User.fromIdentity(identity)` covers the create row (including the email fallback), and
  `User.sync(user, identity)` covers the returning rows, returning `Option<User>` that is
  `Some` only when a field changed. `resolve` only orchestrates: it looks the user up,
  calls one of these, and writes when there is something to write. The rules themselves
  are unchanged.

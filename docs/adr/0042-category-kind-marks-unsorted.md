# A `kind` field marks the Unsorted Category

Every User owns one Unsorted Category, created with the User on first sign-in (ADR-0032).
M1 must protect it from rename and delete, and Items fall back to it. The `Category`
entity has no field that says which Category is Unsorted. The only candidate is its name,
through the `(user, name)` unique index. PRD-0004 planned an `isDefault: true` flag and a
`Category.createDefault(user)` factory, but neither was built.

**`Category` gains `kind: 'unsorted' | 'custom'`. `Category.create` always produces
`'custom'`. A separate `Category.createUnsorted(user)` produces the Unsorted Category with
`kind: 'unsorted'`. A partial unique index on `categories(user) WHERE kind = 'unsorted'`
guarantees at most one per User.**

`UnsortedCategory = Category & { kind: 'unsorted' }` and
`CustomCategory = Category & { kind: 'custom' }` narrow on the field itself, the same
literal-field narrowing ADR-0012 uses for `plan`. M1's rename and delete can then take a
`CustomCategory`, so passing Unsorted is a compile error.

## Considered options

- **Reserve the name "Unsorted"** (rejected). It needs no schema change, but translating
  the name breaks it, and so does a user who creates or renames a Category to "Unsorted".
- **A `users.unsorted_category` foreign key** (rejected). It is the only option the
  database enforces as "exactly one", but `users` and `categories` would reference each
  other, so the first insert needs a deferred constraint or a nullable column.
- **PRD-0004's `isDefault: boolean`** (rejected). It works the same at runtime, but a
  boolean does not narrow into two named types, and "default" also describes the default
  Wishlist (PRD-0006), which carries no protection.
- **`kind: 'unsorted' | 'custom'` with a partial unique index (chosen).** It names the
  role, narrows by type, and the database stops a second Unsorted from appearing.

## Consequences

- **Migration** (lands in M0 step 4's migration with ADR-0040's `name_source`):
  `categories.kind TEXT NOT NULL DEFAULT 'custom'` and a partial unique index
  `categories_user_unsorted_idx ON categories(user) WHERE kind = 'unsorted'`.
- **`libs/domain`:** `Category` gains `kind`, `Category.createUnsorted(user)` is added, and
  `from`/`plain` carry the field. The Unsorted name is a constant in the domain, set once
  at creation. The name is not what identifies it.
- **Unsorted can still be renamed by the database.** Only the type and M1's service stop it.
  That is the same protection level as every other domain rule.
- **PRD-0004 is superseded** on `isDefault` and `createDefault`.
- **No "exactly one" guarantee from the database.** The index allows zero. Creating the
  User and the Unsorted Category in one transaction (ADR-0041) is what guarantees one
  exists.

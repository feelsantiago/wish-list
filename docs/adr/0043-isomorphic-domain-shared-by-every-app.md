# The domain is isomorphic and shared by every app

ADR-0004 lets `libs/<feature>/data` import `libs/domain` **type-only**, so `apps/web` never
bundles domain code. M0 step 6 is the first `data` lib, and building it shows the cost of
that rule. A request schema can't reuse `Wishlist.$`, so it either restates the domain's
rules or checks only the shape. And a client that receives a `Plain<Wishlist>` has no
`Wishlist.from` to rebuild it with, so every app would read API data its own way.

The type-only rule existed because the domain might not run in a browser. In practice
almost all of it already does. The only Node coupling is three `randomUUID` imports from
`node:crypto` (`Id`, `Wishlist`, `Reservation`) and `types: ["node"]` in
`libs/domain/tsconfig.lib.json`. Its runtime dependencies (`zod`, `ts-pattern`,
`magic-regexp`, `@wish-list/common-result`, the root of `@wish-list/common-error`, and
`tldts` via `@wish-list/common-utils`) are all browser-safe.

**`libs/domain` is isomorphic: no `node:*` imports and no Node globals, enforced by lint.
Any lib or app may import it at runtime. Domain zod schemas (`Entity.$`) are the only
definition of each rule. `Plain<T>` is the wire format in both directions: the API sends
`Entity.plain(x)`, and every client rebuilds with `Entity.from(json)`.**

```ts
// libs/wishlist/data: composes, never restates
export const CreateWishlistRequest = Wishlist.$.pick({
  name: true,
  style: true,
});
export type CreateWishlistRequest = z.input<typeof CreateWishlistRequest>;
export type WishlistResponse = Plain<Wishlist>;

// apps/api: the service returns the domain type, the edge serialises it
return this.wishlists.create({ user: user.id, ...body }).map(Wishlist.plain);

// apps/web: the same entity, rebuilt from the wire
const wishlist = Wishlist.from(response.data);
```

- **Services return domain types.** The controller calls `plain()`, so services stay free of
  wire concerns (ADR-0025). A CLI or worker gets the entity itself.
- **Responses carry the full `Plain<T>`**, because `from` needs every field. Leaving a field
  out of a response means defining a separate, named type in the `data` lib, and doing that
  is a deliberate decision.
- **A `data` lib holds no rules.** It holds request schemas built from domain schemas
  (`.pick`, `.extend`, `.partial`) and response type aliases. Only the wire adds fields of
  its own, such as pagination.

## Considered options

- **Type-only imports, rules restated in `data`** (the status quo, rejected). Each rule lives
  in two places and drifts silently, and clients can't rebuild entities.
- **Shape-only `data` schemas, rules only in the domain** (rejected). Nothing is duplicated,
  but an empty name gets past the validation pipe and fails as a bare `invalid`, with no
  `issues` list for the form to display (ADR-0036).
- **The domain imports `data` schemas** (rejected). Nothing is duplicated, but the
  dependency direction reverses: the ubiquitous language would depend on a feature's wire
  contract.
- **An isomorphic domain shared at runtime** (chosen). One definition per rule, one way to
  read API data, and the only price is removing three `node:crypto` imports.

## Consequences

- **This amends ADR-0004**: its type-only clause is removed. `ui` → `data` → `domain` is a
  runtime edge.
- **This extends ADR-0009**: `Plain<T>` was the persistence and response shape. It is now the
  shape clients parse responses back from.
- **`Entity.$` is public API.** Renaming a field or tightening a rule changes request
  validation and the web form in the same commit, which is intended.
- **`Entity.from` trusts its input.** It casts rather than validates, so a client that
  rebuilds from a malformed response gets a malformed entity. Whether clients validate
  responses (for example `Entity.$`-backed response schemas) is left for a later decision,
  made once `apps/web` exists.
- **`tldts` reaches the web bundle** through `Url`/`UrlMetadata`. It's acceptable for now;
  revisit if bundle size matters.
- **UUIDs come from Web Crypto** (`crypto.randomUUID()`, behind `Uuid.generate()`), which
  is available in Node 19+ and in secure browser contexts.
- **Enforcement is a compiler setting plus lint.** `libs/domain/tsconfig.lib.json` uses
  `lib: ["es2022", "dom"]` with `types: []`. That types the web standards both runtimes
  share (`URL`, `crypto`) without `@types/node`. Lint then bans every Node built-in import
  (`node:*` and bare names), and bans globals that exist in only one runtime (`window`,
  `document`, `process`, `Buffer`, and others). Spec files are exempt.

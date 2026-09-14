# Generator do-notation, not chained `.andThen()`, for composing multi-step service logic

`libs/item/service`'s `ItemService.create` is the first `service` lib in the workspace
(ADR-0004), composing five sequential fallible steps — Url validation, a Wishlist
ownership check, a Category ownership check, `Extractor.extract`, and Item/Extraction
reconciliation — each of which can short-circuit the rest. Nothing in the workspace had
written down how a service should compose steps like this before; the only precedent was
unwritten, sitting in `Extractor.lookup` (`libs/extraction/src/lib/extractor.ts`), which
already solves the identical shape.

**Multi-step fallible composition uses `@wish-list/common-result`'s generator do-notation
(`Result.safeTry(this, async function* () { const x = yield* stepA(); ... })`), not a
chain of `.andThen()` calls.** `Extractor.lookup` and `Extractor.reuse` already do this;
`ItemService.create` follows the same shape, and future `service` libs (`wishlist`,
`category`, `coupon`, `sharing`, `tracking`) are expected to as well.

```
// yes
Result.safeTry(this, async function* () {
  const url = yield* Url.create(input.url).mapErr(ServiceFailure.invalid);
  yield* this.checkWishlist(input.wishlist, input.user);
  yield* this.checkCategory(input.category, input.user);
  const extraction = yield* this.extractor.extract(url).mapErr(ServiceFailure.unexpected);
  return this.reconcile(...).toPromise();
});

// no
Url.create(input.url).mapErr(ServiceFailure.invalid).andThen(url =>
  this.checkWishlist(...).andThen(() =>
    this.checkCategory(...).andThen(() =>
      this.extractor.extract(url).andThen(...))));
```

## Considered options

- **Chained `.andThen()` (rejected).** Reads inside-out or via deep nesting once more
  than two steps are involved — five here — and each step's success value must be
  threaded manually into the next closure's parameters. No existing multi-step composition
  in `libs/` actually does this: every `.andThen()` call in the codebase terminates a
  single op, never chains a second one.
- **Generator do-notation via `Result.safeTry` (chosen).** Reads top-to-bottom like normal
  imperative code; `yield*` short-circuits on `Err` the same way `await` does on
  rejection, and intermediate values (`url`, the checked Wishlist, the `Extraction`) stay
  in scope as plain local variables instead of nested closure parameters. Already proven
  in `Extractor.lookup`/`Extractor.reuse`.

## Consequences

- A step being `yield*`-ed must itself be a `Result`/`AsyncResult`, not a boolean or a
  thrown exception — this reinforces CLAUDE.md's existing "no bare `try`/`catch` in
  `libs/domain`, use `Result`" rule by extending it to the composition layer, not just
  individual operations.
- `Result.safeTry`'s generator body captures `this`, so a service's dependencies must be
  reachable as instance fields (constructor-injected `@Injectable()` providers) rather than
  passed into a free function — consistent with CLAUDE.md's "no top-level helpers in files
  exporting a class" rule already pushing helpers onto the class.
- Async and sync bodies use the same `Result.safeTry` entry point (overloaded on
  `Generator` vs `AsyncGenerator`); a service composing only synchronous domain calls
  doesn't need a different construct than one also awaiting a repository call.

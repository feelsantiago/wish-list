# ServiceFailure as an extensible service-layer failure vocabulary

ADR-0018 established that each layer translates errors into its own vocabulary at its
boundary, and explicitly deferred the service layer's own type: "`service` will do the
same thing one layer up — wrapping `DatabaseFailure` into whatever its own failure type
turns out to be." This ADR settles it. `ServiceFailure` is a generic, extensible alias
over `Failure` (ADR-0010), exported from a `@wish-list/common-error/service` subpath,
and every service lib unions its own names onto the shared base:

```ts
export type ServiceFailureType =
  | 'not-found' | 'invalid' | 'forbidden' | 'plan-required' | 'conflict' | 'unexpected';

export type ServiceFailure<T extends string = never> = Failure<ServiceFailureType | T>;
```

```ts
// libs/extraction
export type ExtractionFailure = ServiceFailure<'persist-failed' | 'misconfigured'>;
```

The vocabulary is deliberately **API-agnostic**. It contains no HTTP concepts, no status
codes, no transport vocabulary — service libs are consumed by `apps/api` today but must
remain usable by a CLI, a cron worker, or a queue consumer without carrying HTTP
semantics they don't need. Mapping `Failure.name` → HTTP status stays where ADR-0010 put
it: a single `ts-pattern` match at the `apps/api` boundary.

Failure names are **kebab-case** workspace-wide. `DatabaseFailure`'s original
`'notFound'` was the sole camelCase holdout and is refactored to `'not-found'`.

## Considered options

- **A closed union per service lib, no shared base**: each feature invents its own
  failure names from scratch. Maximum precision per service, but the `apps/api` boundary
  match can never be exhaustive over an open-ended set of unrelated unions, and every
  service re-derives "not found" and "forbidden" independently under slightly different
  names. Rejected.
- **A single closed `ServiceFailure` with no extension point**: one union, trivially
  exhaustive at the API boundary, but genuinely service-specific modes
  (`'extraction-failed'`, `'already-reserved'`) have nowhere to go except metadata on a
  generic name, which erases them from the type system. Rejected.
- **`ServiceFailure` in a new `libs/common/service` lib**: gives service-layer
  primitives a home of their own, but creates a lib whose only content is one type, and
  splits the failure vocabulary across two `common` libs. Rejected.
- **Generic base with per-service union extension (chosen)**: the shared names cover the
  cases every service has, the generic parameter admits the ones only one service has,
  and the base union is still closed enough for the API boundary to handle exhaustively
  with a documented fall-through to 500 (ADR-0010's intended forcing function).

## Consequences

- `plan-required` is a first-class base variant rather than `forbidden` with metadata.
  Plan is a first-class `CONTEXT.md` term gating Coupon Rule, Reservation, and Tracking;
  "you lack the Pro plan" and "you don't own this Wishlist" are different conditions with
  different remedies, and collapsing them hides the distinction from the type system.
- `unexpected` collapses all three infrastructure `DatabaseFailure` names
  (`constraint`/`query`/`mapping`). Services above the database do not need to reason
  about driver failure modes; the `source` chain preserves the detail for logs. Splitting
  `constraint` back out is the obvious first revision if uniqueness violations ever need
  to be distinguished from a dead connection.
- A service's own failure namespace does **not** re-export the generic factories.
  Callers write `ServiceFailure.notFound(...)` and `ExtractionFailure.persistFailed(...)`
  side by side — two namespaces, no shadowing, and the origin of each failure is visible
  at the call site.
- The subpath export (`@wish-list/common-error/service`) follows the existing
  `renderers` precedent in the same lib, keeping the main entrypoint dependency-light and
  making the service vocabulary opt-in rather than visible to `libs/domain` and
  `libs/database`, which have no business using it.

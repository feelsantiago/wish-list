# Database layer only ever returns DatabaseFailure

`libs/database` introduces its own `DatabaseFailure` (`Failure<'notFound' | 'constraint' | 'query' | 'mapping'>`, ADR-0010's pattern) as the sole error type crossing its boundary into `service`. Every repository method returns `AsyncResult<Entity, DatabaseFailure>`, never a raw `DomainFailure` or an unwrapped libsql/driver error — even when the failure *originates* as a `DomainFailure` (e.g. `Item.from(row)` fails Zod validation when reconstructing a row read back from the DB) it gets re-tagged into `DatabaseFailure`'s `mapping` variant via `Failure.from(domainFailure, {...})`, which preserves the original as `source` for the causal chain (`.toString()` still renders "caused by: [validation] ...") without leaking `DomainFailure`'s type into `service`'s error-handling surface.

The principle generalizes: each layer translates errors into its own vocabulary at its boundary, rather than letting a lower layer's failure type leak upward untranslated. `service` will do the same thing one layer up — wrapping `DatabaseFailure` into whatever its own failure type turns out to be, rather than a `service` function's signature ever mentioning `DatabaseFailure` or `DomainFailure` directly.

We considered letting `libs/database` pass `DomainFailure` straight through for the `mapping` case (skip re-tagging, since it's "just" a validation error) and having `service` catch both `DomainFailure` and `DatabaseFailure` from a repository call. Rejected: it means every downstream `ts-pattern` match on repository call results needs to exhaustively handle two unrelated failure-name unions instead of one, and it breaks the "each layer speaks its own vocabulary" boundary the moment any repository has this one exception.

## Consequences

- New repository-layer failure modes get a new `DatabaseFailure` variant name, not a reused `DomainFailure` one.
- The `apps/api` boundary mapping function (ADR-0010) that turns `Failure.name` → HTTP status only ever needs to know about the failure vocabulary of the layer immediately below it in the chain it actually receives (whatever `service` settles on) — it never needs a case for `DatabaseFailure` or `DomainFailure` names directly.

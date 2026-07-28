# Item persisted as a single table with nullable columns

`Item`'s three Extraction Status variants (`PendingItem`/`ExtractedItem`/`FailedExtractionItem`, ADR-0008) are persisted as one `items` table: a `tag` column holding the discriminator, plus the union of every variant's fields, with `name`/`price_amount`/`price_currency`/`image` (extracted-only) and `reason` (failed-only) all nullable. This mirrors how the domain itself already models the shared base (`BaseItem`) plus per-variant fields, and keeps the hottest read path in the app — listing a Wishlist's Items — a single-table scan with no join.

We considered class-table-inheritance (a base `items` table plus `items_extracted`/`items_failed` tables joined on a shared id) for stricter column-level non-null guarantees per variant. Rejected: Drizzle/SQLite has no built-in inheritance primitive, so this would be a hand-rolled join maintained entirely in application code, for a table that in practice has only two extra nullable columns per variant — not enough payoff to justify the join cost on every Wishlist page load. We also considered a JSON column holding all tag-specific data untyped, which would lose column-level typing and indexing on `name` (a field the UI needs to search/sort on) for no real simplification over a few nullable columns.

## Consequences

- Row validity per `tag` (e.g. `extracted` rows must have non-null `name`) is enforced at the domain boundary via `Item.from(row)`'s reconstruction logic, not by SQL `NOT NULL` constraints — the database schema alone cannot express "these columns are required only when `tag = 'extracted'`" without a `CHECK` constraint duplicating the domain's own validation.
- Adding a new Extraction Status variant means adding its fields as new nullable columns on the same table, not a new table — consistent with how `libs/domain` already extends the union in one file.

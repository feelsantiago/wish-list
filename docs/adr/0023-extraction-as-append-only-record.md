# Extraction as an append-only audited record, and failed extraction as an outcome

Extraction is expensive (an outbound fetch plus, on the fallback path, an LLM call),
frequently unsuccessful (retailers block scrapers), and needed by more than one feature
(Item creation now, Price Tracking later). We make each attempt a first-class, persisted
domain entity rather than a transient function result.

**`Extraction` is a domain entity, append-only, one row per attempt**, keyed on a
normalized `ExtractionKey` with an index on `(key, created_at)`. Nothing updates a row;
the current state of a URL is the latest row for its key.

**A failed extraction is a recorded outcome, not an error.** `Extractor.extract` returns
`AsyncResult<Extraction, ExtractionFailure>` where `Extraction` is a `succeeded | failed`
union, and the `Err` branch is reserved for infrastructure breakage (`persist-failed`,
`misconfigured`):

```
Ok(SucceededExtraction)  → resolved Vendor + ExtractedItem
Ok(FailedExtraction)     → provisional Vendor + PendingItem, queued for retry
Err(ExtractionFailure)   → the database write failed, or the module is misconfigured
```

A blocked retailer is normal, expected, audited, and retryable — it is data. An
unavailable database is none of those. The distinction is load-bearing rather than
stylistic: both outcomes carry a Vendor `Id`, which the caller needs in order to
construct an Item at all (ADR-0022), and an `Err` branch cannot deliver one.

## Considered options

- **One mutable row per key, updated in place.** A cache with a timestamp. Point reads,
  bounded table size. But "audit" and "update in place" are contradictory: you can never
  answer "what did this page say last month" or "how many times has this URL failed", and
  a retry queue cannot implement backoff without an attempt history. Rejected.
- **Reuse the `items` table as the extraction cache** — look up any already-extracted Item
  with the same URL and copy its metadata. Zero new storage, persistent, already indexed.
  Rejected outright: `Item.correct()` means `items` records _user-edited_ values, not what
  the page said, so reuse would propagate one user's manual correction into another user's
  Item. `items` is not a faithful record of any extraction.
- **Put every failure in the `Err` branch.** One failure type, conventional
  Result-handling. But then `item/service` must inspect `failure.name` to work out whether
  it still has a usable Vendor — precisely the lower-layer leak ADR-0018 exists to prevent
  — or call a separate Vendor-provisioning step first, resurrecting the `vendor/service`
  lib that ADR-0025 eliminates. Rejected.
- **Append-only records with the outcome split (chosen).**

## Consequences

- Reuse policy is expressed as two methods, not a parameter: `extract(url)` returns a
  sufficiently fresh record without touching the network; `refresh(url)` always fetches.
  Price Tracking's daily fetch must use `refresh` — with `extract` it would re-read
  yesterday's snapshot and record the same price forever.
- **Failed records are reused too** (negative caching), on a much shorter window than
  successes. Without it, a client repeatedly posting one bot-walled URL produces one
  outbound fetch per request. Rate limiting caps the caller; negative caching caps the
  outbound blast radius; they are complementary, not alternatives.
- `'unsupported-currency'` is permanent and never re-attempted. Re-scraping a GBP page
  will always yield GBP while `Currency` remains `'USD' | 'BRL'`.
- `SucceededExtraction` snapshots the Vendor's claimed `name`/`website`/`currency`
  alongside the Vendor `Id`, duplicating what the `vendors` row holds. Deliberate: the
  `vendors` row is live state that gets overwritten on promotion, while the snapshot must
  stay immutable to be worth auditing.
- Two price timelines now exist and must not be merged. **Price History** is per-Item,
  per-user, only for Tracked Items, and is what the UI graphs. **Extraction** is per-URL,
  global, every attempt by anyone, and is infrastructure. Tracking's daily fetch writes
  both — one Extraction row as a side effect of `refresh`, one Price History entry for the
  Item.
- `ExtractionKey` normalization is the load-bearing detail:
  `amazon.com/dp/B0XYZ?tag=aff-20` and `amazon.com/dp/B0XYZ` must produce one key or the
  reuse rate collapses. Normalization strips a _named denylist_ of tracking parameters
  rather than all query parameters, because many retailers encode the actual product
  variant (size, colour, SKU) in the query and collapsing those would serve the wrong
  product's price.

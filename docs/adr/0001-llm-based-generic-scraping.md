# LLM-based generic scraping instead of per-vendor parsers

Items are captured from arbitrary retailer URLs, so we need to extract name/price/image/currency from pages we don't control. Instead of writing structured scrapers per vendor (Amazon parser, Mercado Livre parser, ...), we feed page content to an LLM and ask for structured JSON. This works immediately on any site without per-vendor maintenance, at the cost of per-request latency/spend and occasional extraction errors — mitigated by letting users manually correct fields afterward. Per-vendor parsers can be added later for specific high-volume vendors if precision or cost demands it.

## Amendment — structured data is tried before the LLM

`libs/extraction` attempts JSON-LD (`schema.org/Product`) and then OpenGraph/`product:price:*` meta tags before falling back to the LLM path. These are generic web standards emitted by most SEO-conscious retail platforms, so they retain this ADR's defining property — works on any site, no per-vendor maintenance — while removing the LLM call entirely on the common path. That is the single largest lever on both the latency and the spend this ADR accepted as its cost, and it makes a bounded inline extraction budget realistic.

The LLM remains the general case and the only path that handles pages carrying no structured data. What changed is the ordering, not the strategy: this is still generic extraction, not the per-vendor parsers rejected above.

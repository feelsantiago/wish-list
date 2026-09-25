# Wish List

A multi-user SaaS for tracking desired items scraped from arbitrary retailer websites, organizing them, and applying coupons and price tracking.

## Language

**User**:
An account holder, authenticated via an OAuth provider. Owns Wishlists, Categories, and a Plan. Carries a Status.

**Status** (of a User):
Active or Deactivated. A User is never hard-deleted — deactivation blocks login but leaves all owned data (Wishlists, Items, Categories) untouched, and reactivation restores full access as-is. A Deactivated User's requests are refused at the authorization step, distinctly from an ownership denial. Distinct from a Wishlist's own publish/unpublish control (see Sharing) — deactivating a User does not affect whether their Wishlists' share links resolve.
_Avoid_: don't confuse with Item's Status (Wanted/Fulfilled) or Extraction Status

**Plan**:
A subscription tier (Free or Pro) that gates feature access. Free includes manual Coupon storage; Pro adds the Coupon Rule engine and auto Price Tracking.
_Avoid_: Tier (use Plan), Subscription (the billing record, not the tier itself)

**Ownership**:
The relation between a User and the Wishlists, Categories and Coupons they hold. Every mutation on an owned entity is performed by its owner — there is no sharing of write access, no delegation, and no admin actor. An Item is owned transitively, through the Wishlist it belongs to, and is never owned directly. A Reservation has no owner — it is held by an anonymous token (see Sharing).
_Avoid_: Permission, Access (both imply a grantable right; Ownership is a fixed fact about the data, not something conferred)

**Wishlist**:
A named, ownable collection of Items belonging to one User. A User may own several. Shareable independently via its own link.
_Avoid_: List, Wish list (one word)

**Item**:
A product a User wants, captured by pasting its URL. Metadata (name, price, image, currency) is extracted automatically via LLM-based scraping and may be corrected manually by the User afterward. Belongs to exactly one Wishlist, one Category (defaulting to Unsorted), and one Vendor. Carries a Status. Two Users saving the same URL get two independent Items — there is no shared Item, and correcting one never affects the other.
_Avoid_: Product, Wishlist item (just Item within this context)

**Status** (of an Item):
Wanted or Fulfilled. Fulfilled means the owner has acquired it — a stored state, not a deletion, kept as the seed for a future collection-tracking feature beyond this project's current scope.
_Avoid_: don't confuse with Extraction Status

**Extraction Status**:
Tracks the async LLM-based scraping outcome for an Item, separate from its Wanted/Fulfilled Status. An Item is created immediately from just its URL and exists in a pending state until scraping fills in its fields, or fails and leaves them blank for manual entry.
_Avoid_: don't confuse with Extraction — this is the Item's own state, not the attempt record

**Extraction**:
A single recorded attempt to read a product's details from a URL. Every attempt is kept, whether it succeeded or failed, so the system can tell what a page said at a given moment, how often a retailer has refused, and whether a recent enough reading already exists to reuse instead of fetching again. Global rather than per-User — one attempt serves whoever asks next. Distinct from Price History: an Extraction belongs to a URL and records an attempt, a Price History entry belongs to a Tracked Item and records a price.

**Structured Data**:
Product details a page publishes about itself in a machine-readable web standard (schema.org JSON-LD, OpenGraph meta tags), readable without an LLM. Generic across retailers — never per-Vendor rules. A page's Structured Data is **complete** only when it supplies every field an Extraction needs (name, price, currency, image, vendor name); anything less is discarded in favour of the next reading, since a partially filled Item is worse than an LLM-read one.
_Avoid_: Metadata (too broad), Scraping (that's the whole act of reading a page)

**Extraction Source**:
Which reading produced a succeeded Extraction — the page's own Structured Data (JSON-LD or OpenGraph) or the LLM. Recorded so the system can tell how much of its traffic avoids the LLM, and which retailers depend on it.

**Extraction Key**:
The identity under which Extractions for the same product page are grouped. Two URLs that differ only in tracking or referral decoration share one Extraction Key; URLs that select genuinely different products — a different size or colour — do not.

**Vendor**:
The retailer an Item was scraped from, derived automatically from the URL's registrable domain the first time it's seen (e.g. `amazon.com` → Amazon). Not a curated allowlist. Each registrable domain is its own Vendor — `amazon.com` and `amazon.com.br` are two distinct Vendors, not merged by brand, since they also differ in Currency. A Vendor is **provisional** when it is known only by its domain, and **resolved** once an Extraction has established its name and Currency; a provisional Vendor cannot carry Coupons, since a Coupon's discount is denominated in the Vendor's Currency. Resolution happens once and is never undone.
_Avoid_: Store, Retailer, Site

**Category**:
A user-defined label for organizing Items, global to the User (shared across all their Wishlists, not scoped to one). An Item belongs to exactly one Category — every User is provisioned an **Unsorted** Category at signup as the default, so an Item is never categoryless even before the User picks one explicitly. Unsorted cannot be renamed or deleted.

**Coupon**:
A discount code a User stores manually, available on the Free plan. Belongs to exactly one Vendor (the retailer it's redeemable at) and carries its own expiration date. Its discount is either a fixed amount off (in the Vendor's Currency) or a percentage off (capped below 100, since a 100%-off coupon would make the Item free rather than discounted). A Coupon Rule's vendor and validity conditions are inherited from this, not restated on the Rule. Never attached to an Item as a stored relation — matching and Effective Price are computed fresh each time, so an expired Coupon never leaves a stale reference behind.

**Coupon Rule**:
A Pro-only condition (price threshold in a given Currency) that automatically matches and attaches an unexpired Coupon to qualifying Items of the Coupon's own Vendor, without manual entry per Item. Attaching a Coupon does not change the Item's stored price; it surfaces an Effective Price alongside it.
_Avoid_: Cupon, Coupon engine (that's the subsystem name, not this term)

**Currency**:
The currency an Item's price was scraped in (e.g. USD, BRL). Never converted or normalized elsewhere in the system — prices and Coupon Rules are always compared within the same Currency.

**Effective Price**:
An Item's price after its attached Coupon is factored in, shown alongside the original scraped price. Items can be filtered by whether one is present.

**Sharing**:
Publishing a Wishlist at its own stable, unlisted link, viewable by anyone with it, without requiring the viewer to sign in. Every Wishlist carries this link from creation but is only reachable by it while published; the owner can unpublish (closing the link entirely) or replace the link (invalidating the old one without unpublishing).

**Reservation**:
A Pro-only claim a Sharing viewer places on an Item, with their name attached, to signal to other viewers it's already being gifted. At most one per Item. The viewer who placed it can cancel it later. Whether the Wishlist's owner can see Reservations at all is controlled per-Wishlist (see Surprise Mode).
_Avoid_: Purchased, Claimed

**Surprise Mode**:
A per-Wishlist style, either `surprise` (owner can't see Reservations on their own Items — the default, for gift lists) or `default` (owner can see them, e.g. for donation-style lists where the owner wants to see who's taking what).

**Tracked Item**:
An Item a User has opted into daily automatic price fetching for (Pro-only). Each fetch appends to the Item's Price History rather than triggering a notification.

**Price History**:
The chronological record of an Item's fetched prices over time, used to show whether it's trending lower or higher. Belongs to one User's Tracked Item, and is the series shown to that User — not to be merged with Extraction, which records attempts against a URL for the whole system.

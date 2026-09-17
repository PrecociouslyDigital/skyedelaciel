# resolve.ts

## 2026-09-15 — two date bugs that the old `catch` hid

`parseDateParts` called `getUTCDay()` — the *weekday*, 0–6 — where it meant
`getUTCDate()`. For `2026-02-08` that produced day `0`, which the old
`formatCslDate`'s `month && day` truthiness test read as "no day", so the link
rendered "February 2026". On any other weekday it rendered a plausible but
wrong day, which is why it survived so long.

The second one only shows up with unparseable input. `new Date(garbage)` gives
an Invalid Date, so the old code stored `[[NaN, NaN, NaN]]`. `JSON.stringify`
writes NaN as `null`, the cache reads back `[[null, null, null]]`,
`parts.map(Number)` turns that into `[0, 0, 0]`, and the year-only fallback
printed the literal string **"0"**. `parseCslDate` now checks `Date.parse`
first and keeps unparseable input in CSL's own `raw` variant.

## 2026-09-15 — DOI resolution does not currently work

Unrelated to the refactor, found while verifying it. Two independent problems,
so fixing either alone changes nothing:

1. `api.crossref.org/works/{doi}` answers **406** to the
   `application/vnd.citationstyles.csl+json` Accept header. Content negotiation
   against `https://doi.org/{doi}` returns the same data and does work.
2. What CrossRef returns is not CSL-JSON as `cslData` defines it. `type` is
   `"journal-article"` (CrossRef's vocabulary, not CSL's `"article-journal"`),
   there is no `id` (the DOI lives in `DOI`), and each author carries
   `sequence` / `affiliation` / `role`, which `.strict()` rejects.

So a real fix is a CrossRef → CSL normalisation step, not a URL change. Until
then DOI links resolve to the `unresolved` variant: no popover, and a bare-URL
MLA entry in the bibliography. That is at least visible now — under the old
per-resolver `catch` it was indistinguishable from a successful lookup that
happened to find nothing.

## 2026-09-16 — DOI resolution works; both halves were needed

The post-mortem above called for a URL change *and* a normalisation step, and
that held: fixing either alone still resolved nothing.

The endpoint is now a two-rung ladder. Crossref's
`/works/{doi}/transform/application/vnd.citationstyles.csl+json` answers where
the old `Accept`-header request got a 406, and it is the richer source. But
Crossref only knows its own DOIs — `10.48550/arXiv.1706.03762` is a DataCite
DOI and Crossref answers **404** for it — so content negotiation against
`https://doi.org/{doi}` is the second rung rather than an alternative to the
first. Both are load-bearing: four real DOIs across Crossref journal,
Crossref conference and DataCite preprint now resolve, and a nonexistent one
still falls through to `unresolved`.

Normalisation moved to `crossref.ts`. What stayed here is the decision that a
registrar answering with an unusable payload is a *failed* lookup: `toCsl`
throws rather than returning something partial, so the existing catch turns it
into the `unresolved` variant and nothing is cached. That is the same rule the
date bugs taught — a lookup that half-worked must not be indistinguishable
from one that worked.

`extractDoi` also kept any query string or fragment the author wrote, which
would have been sent to the registrar as part of the identifier.

## 2026-09-16 — what is left here

The three resolvers and the URL classification moved to `sources.ts`; see that
breadcrumb for why. What stays is the part that is about a *document's worth*
of links rather than about any one source: deduplication, the cache lookup
that precedes every fetch, the rule that failures are never cached, and the
`unresolved` variant that a failed lookup collapses to.

`classify` is gone as a name. It was a hand-written if-chain that had to stay
in step with the `LinkKind` enum, and it is now the registry's claiming order.

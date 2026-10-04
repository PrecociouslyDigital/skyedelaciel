# cache.ts

## 2026-10-03 — `CACHE_VERSION`, because optional fields can't invalidate anything

`description` and `fields` were added to `resolvedLink` as optional. That is
right for the schema, since most links have neither. It also means every entry
cached before they existed still parses, and would serve a popover without
them for up to the 7-day TTL. Nothing in the entry can say "this was resolved
before the resolver knew to look".

The file is now `{ version, entries }`, and a file whose `version` isn't
`CACHE_VERSION` is dropped whole. The old unversioned shape fails that parse
too, so the first build after this change re-resolves everything. Raise the
number whenever a resolver learns to fetch something new. Changing the schema
alone doesn't need it, since entries that no longer parse are dropped one by
one as before.

## 2026-10-03 — the fixture page links real URLs, pinned in a file of its own

The kitchen-sink fixture used to link made-up addresses (`example.com`,
`10.0000/…`, `Fixture_article`) with hand-written entries in
`manual-links.json`. It now links real pages: a Diff post, an *npj Heritage
Science* paper and Wang Xizhi on Wikipedia. Their entries were recorded by
building once with an empty cache and copying out what the resolvers
produced, with the images replaced by copies in `src/assets/link-images/`
(credited in `CREDITS.md` there). Resolving them live would make the design
suite need the network, and would let an edit to any of those pages turn a
test red.

The pins live in `src/content/fixtures/links.json`, read only when
`INCLUDE_FIXTURES` is set, rather than in `manual-links.json`. An override
there applies site-wide with no TTL, so a real article linking Wang Xizhi
would have been served the frozen fixture copy forever.

A finding from the swap: the old fixture's Wikipedia summary had been written
long enough to push the ledger below the fold, and a test asserted exactly
that. Wang Xizhi's real lead is shorter, and the ledger's first rule shows at
rest. Nothing in the CSS ever promised otherwise, so the spec and the test now
say what the layout does guarantee: the ledger follows the summary, and
scrolling the text reaches all of it.

Mount Fuji was pinned the same way later, as a banner whose text (summary and
infobox) overflows, so the banner giving way can be seen by hand and tested
without lengthening a summary in the test.

# sources.ts

## 2026-09-16 — one source, declared once

Adding a kind of link used to mean editing five places that had to agree:
the `linkKind` enum, `classify`, `resolveRemote`'s `match`, `buildPreview`'s
`match`, and `isCitable`, which independently re-encoded
`kind !== "internal"`. Four of those are dispatch on the same value, so the
compiler could tell you a `match` was inexhaustive but not that the five
descriptions of a source had drifted apart. With Wikipedia full text, arXiv
and Europe PMC arriving, that cost multiplies by every source.

So a source is now one object, and the dispatch sites read from it.

**Coverage is a compile error, not a test.** `byKind` is annotated
`Record<LinkKind, Source>`, so a kind added to the enum without a source
here — or a source for a kind that no longer exists — fails `astro check`.
That is the one property worth having the type system carry, because it is
the one that used to be carried by nothing.

**Claiming order is insertion order**, most specific first. This is the
hazard the registry introduces in exchange: `external.claims` returns true
unconditionally, so a predicate written too broadly, or a source moved after
`external`, silently shadows everything below it and the failure looks like a
popover that renders the wrong fields. `tests/unit/sources.test.ts` carries a
URL-ownership corpus for exactly that, including the cases that distinguish
`doi.org/10.…` from `doi.org` itself. `classify` had no direct test before,
so this is new coverage rather than moved coverage.

Two alternatives rejected. An explicit `precedence` number on each source
makes the ordering visible but adds a field that can disagree with itself
across sources. A separate ordered array beside `byKind` means two lists to
keep in step, which is the problem this file exists to remove — ES2015
guarantees string-key insertion order, so `Object.values` is enough.

**`resolve` is optional, and that is the point.** "Internal links are never
fetched" used to be a `RemoteKind = Exclude<LinkKind, "internal">` plus a
filter that named the kind at the call site. Now a source that is not fetched
simply has no resolver, and `resolveRemoteLinks` narrows on its presence — so
the fact travels with the source instead of being restated wherever links are
walked. `RemoteLink` exists so that narrowing survives into `resolveRemote`
without a non-null assertion.

**`isCitable` moved here from `cite.ts`**, because it is a fact about a kind
of link rather than about formatting, and because `cite.ts` supplies the
author and date formatters that a source's `meta` uses — leaving it there
would have made the two files import each other. Its test came along and was
restated: it used to assert `isCitable(entry) === (entry.kind !== "internal")`,
which re-derived the rule beside the code rather than pinning it.

## 2026-09-16 — a rung that errors is not the end of the ladder

The DOI ladder only fell through on `!res.ok`. A refused connection, a body
that wasn't JSON, or a payload `toCsl` rejected all propagated straight out of
the loop, so doi.org — the rung that exists precisely because Crossref doesn't
know every DOI — was never asked. The failure needed both a Crossref blip and
an author citing a Crossref-registered DOI to be visible, which is why it
survived the four-DOI check that proved the ladder worked.

Per-rung `try`/`catch` now treats every way of not answering alike, and the
`throw` after the loop stays the only exit. `tests/unit/sources.test.ts` drives
this with a stubbed `fetch` across all four failure modes; the 404 case is the
control, since that one already worked.

Also here: "external is tried last" was a property of where `external` sat in
the `byKind` literal, enforced by a comment. It is now `claimants`, which
filters `external` out and appends it, so a source written below it can't be
shadowed. The `Record<LinkKind, Source>` coverage check is unaffected.

`todayParts` and `parseCslDate` moved to `cite.ts`. They are CSL date plumbing,
not facts about a source, and `resolve.ts` was reaching into the source
registry for a date helper to stamp `accessed` — `cite.ts` already owns
`formatCslDate` and `cslYear`, and `sources.ts` already depends on it, so
nothing gained a cycle.

## 2026-09-16 — the ladder test routes by position, not by hostname

Worth recording because the first version was wrong in a way that looked
right. It stubbed `fetch` and picked an answer by testing the endpoint for
`"crossref.org"`, so if the endpoints were ever renamed or reordered the first
rung would quietly receive the *success* payload and every case would pass
without the fallback running at all. Pointing that substring at something that
never matches left all twenty-two tests green.

It now answers by call order and records what was asked, and each case asserts
that both rungs were walked and that the second is what answered. The same
substring still appears, but as an assertion rather than as routing — so a
renamed endpoint fails the test instead of hiding inside it.

## 2026-09-17 — the provenance mark is a field, so a kind cannot ship without one

Every link in the prose now wears a glyph saying where it leads — `§`, `↗`,
`¶`, `W`. The tempting shape is a lookup table beside the registry, keyed by
kind. That is exactly the shape this file exists to have removed: a second
list to keep in step with `byKind`, and nothing to notice when it drifts.

`mark` is a field on `Source` instead, so the `Record<LinkKind, Source>`
annotation that already made a missing source a compile error now makes a
missing glyph one too, for free. The one thing the type cannot see is two
kinds sharing a glyph, which would leave a reader unable to tell them apart
with nothing going red — `tests/unit/sources.test.ts` carries that as a
distinctness property.

`isResolved` is here for adjacency rather than because it is about a source.
Every render site asks both questions at once — which kind of address is this,
and did anything answer — and they are genuinely independent: `resolution` is
a property of the lookup, `kind` of the URL. Keeping the pair together is what
stops a call site deciding for itself that "no entry" means "internal", or
that "unresolved" deserves a fifth glyph.

The one case worth stating is the exception in it. A bare `#fragment`
addresses the page the reader is already on, so no lookup was ever attempted
and nothing is missing; without that clause every in-page cross-reference in
design.mdx would be marked as a dead end.

## 2026-10-03 — `meta` takes the entry; arXiv is a DOI; two kinds of useless image

**`Source.meta` takes the whole `ResolvedLink`, not its `csl`.** Wikipedia's
meta line is the article's short description, which has no CSL field to live
in. Putting it in `csl.note` or `csl.genre` would have leaked it into the MLA
bibliography. `description` is a top-level field on the entry instead, and the
other sources destructure `{ csl }` exactly as before.

**arXiv links are claimed by `doi`.** arXiv registers a DataCite DOI for every
paper, `10.48550/arXiv.<id>`, with no version suffix. That DOI is already
reachable through the registrar ladder's doi.org rung. A separate arXiv source
would have needed a new kind, a new glyph and an Atom parser to reach the same
CSL. `extractDoi` maps abstract and PDF links, in both the new-style and
old-style ID schemes, and drops `vN`.

**Wikipedia's `originalimage` unless it's an SVG.** The build copies and scales
images itself, and Astro's image service refuses to convert SVG to raster.
Wikipedia's `thumbnail` is already rasterised, so an SVG lead image falls back
to it.

**Two kinds of OpenGraph image are dropped.** Generated cards
(`CARD_GENERATORS`, starting with GitHub's) only set the page title in type.
Site logos are what a site puts on every page that has no image of its own. A
logo is recognised as the page's image being identical, once made absolute, to
the homepage's. That costs one extra `ogs` call per origin per build, memoised.

## 2026-10-06 — `Source` is internal | remote

`resolve` was optional on every source, so each caller had to ask whether it
was there (`NonNullable<Source["resolve"]>` in resolve.ts, a throw in two
tests). Only this site's own pages go unfetched, and that is now the type:
`InternalSource` has no `resolve`, `RemoteSource` always does, and `kind`
discriminates them. `byKind` is `satisfies Record<LinkKind, Source>` rather
than annotated with it, so `sourceOf("doi")` is a `RemoteSource`.

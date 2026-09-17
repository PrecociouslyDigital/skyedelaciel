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

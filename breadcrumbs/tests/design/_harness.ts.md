# tests/design/_harness.ts

## 2026-09-16 — what a design test is allowed to assert

The suite kept failing for reasons that were not about the design, and passing
for reasons that were not about the design either. Two rules came out of the
cleanup, and this file exists to make them cheap to follow:

**Assert the claim, not the declaration.** `flex-direction: column` is not
"arranged vertically" — it is one way of achieving it, and a test that names it
fails a correct rewrite and passes a broken one whose ancestor has the wrong
`overflow`. Every layout claim is now measured from `getBoundingClientRect`.
The same goes for colours: the print scheme is checked for being *its own*
(unaffected by `prefers-color-scheme`, distinct from both screen schemes, the
boldest contrast of the three) rather than for being `#ffffff` on `#000000`.

**A constant belongs to one test.** The site name is produced by
`resolveInternalLinks`, so `tests/unit/links.test.ts` pins it there and nothing
else quotes it; the browser test checks the *shape* of a popover's metadata
instead. `luminance`/`contrast` and `PROSE_LINKS` live here for the same reason.

### PROSE_LINKS

`Bibliography.astro` puts `class="content-link"` on its own entries, so
`article a.content-link` reaches both the links in the text and the works
cited. Every claim in the Links section of the spec is about the former. The
print inline-citation test was matching bibliography entries against itself
before this, which is part of why it reported 34 failures for 4 links.

### Vacuity guards

Most of these tests assert that a list of offenders is empty. That is also what
they report when their selector matches nothing at all, so the ones whose
selector could plausibly stop matching assert a non-zero count first.

## 2026-10-06 — `copyLink()`

Waits for `astro-island:not([ssr])` before handing back a copy link. Clicking
a `client:visible` island too early follows the plain link. The motion spec
hit this on /design/, where the page is heavy enough for the race to show.
The nojs test deliberately clicks the raw locator.

## 2026-10-06 — `token()`

Moved here from annotation.spec and content.spec, which each had a copy,
once figures.spec needed a third.

## 2026-10-06 — tests read their truths from the source

`box(locator)` replaces about thirty `(await x.boundingBox())!`, and the copy
links.spec.ts had of it; a missing box now fails naming the locator rather
than as a TypeError on `null`. `APPARATUS` is numbering.ts's `KINDS`, and
`FIGURES`/`STATEMENTS`, content.spec's labels and figures.spec's
"Fig. → Figure" reading are all built from it instead of restating prefixes
and labels. Elsewhere: headings.spec waits out `HOLD_MS` and `LEAVE_MS` from
receipt.svelte.ts, home/links/sources/tumblr tests take the site's name and
URL from src/site.ts, tumblr.test generates templates with `chance` over
`BLOCKS` and stamps with `THEME_HASH_PLACEHOLDER`, figures.test checks
against `MAX_WIDTH`/`MAX_HEIGHT`, and the navbar and contents specs take
widths from the browse profiles.

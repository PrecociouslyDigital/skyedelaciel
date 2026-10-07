# TableOfContents.astro

## 2026-10-06 — levels are typed

A node's level (1–3) is set once, in `buildTree`, from how many sections are
open above it, and carried on the node (`TocNode.level`, in toc.ts) instead
of threaded through the recursion as a `depth` number. `TOC_LEVELS` holds the
levels, `TOC_DEPTH` the deepest heading listed; both were a bare `3`.
TocEntry's props are a union on `depth`, so `entries` (the vine's length) can
only be given to a top-level entry. `entries` stays optional (see TocEntry.astro.md for `index`): the
Tumblr theme's contents are filled in by Tumblr, so neither is known when it
is built.

# `src/layouts/prelude/section.astro`

## 2026-10-05 — a section is a directory with an `index.mdx`

No list of sections and no `section:` frontmatter field. A list would have to
be kept in step with the directories, and a field could be misspelled or
forgotten. The directory is already true, and the `sections` collection only
globs `**/index.mdx`. The article collections leave those files out, so a
section page can never also be built as an article.

## 2026-10-05 — Everything Else is what the page does not link to

A section page is written by hand, so it can feature, group and annotate
pieces however it likes. What it does not mention still has to be reachable.
Rather than a second list to keep in step, Everything Else is computed from
the links the `extractLinks` remark plugin already collects: the section's
published pieces minus the ones linked. `internalId` (resolve.ts) is how a
link is turned into an id, here and for popovers alike.

It is a `##` added to the TOC's headings, not a heading in the MDX, so it is
dropped together with its entry when nothing is left over.

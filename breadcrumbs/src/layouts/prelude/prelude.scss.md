# prelude.scss

## 2026-09-17 — three constraints that are invisible in the file

**`--frame-inset` is a registered property, and has to be.** It carries
`calc(2ch + 3px)`, and Sidenote.astro reads it to clear the frame. An
unregistered custom property inherits as an unresolved token stream, so the
`ch` would have been resolved at the *reader*, where the font is 0.82rem — the
notes would have sat a couple of characters off, and only in the framed layout.
`@property { syntax: "<length>" }` computes it where it is declared, which is
the article, and inherits the resulting length.

**`font-variant-numeric` must not be set on `body`.** Old-style figures belong
to the prose, so the obvious home for them is `body`. But a non-initial
`font-variant-*` makes the `font` shorthand unserialisable — `getComputedStyle`
returns an empty string for it — and `tests/design/content.spec.ts` measures
the 80-character line by copying `body`'s `font` onto a probe span. With the
shorthand empty the probe would render in the browser default and the measure
test would pass for the wrong reason. The figures are set on the prose blocks
instead, which is where they were wanted anyway.

**The frame's two media queries are complements, on purpose.** Exactly one of
the article and the front matter carries the page frame: `@media screen and
(min-width: $wide)` and `@media not screen and (min-width: $wide)`. Writing it
as one query plus an override would have meant undoing the frame in two places
— narrow, and print — and print is not a width question: a US Letter sheet is
about 51rem, below the wide breakpoint, so paper falls on the narrow side of
every plain width query. The negated form covers it without naming it.

## 2026-09-17 — the heading scale is here rather than in Heading.astro

`Heading.astro` renders the MDX headings, but not all of them: the bibliography
writes its own `<h2>` and the front matter its own `<h1 class="title">`.
Astro's scoped styles would have reached neither. One scale on the bare `h1`–`h6`
selectors covers all three, and Heading.astro keeps only what is about its own
markup — the anchor, and revealing the copy icon on hover.

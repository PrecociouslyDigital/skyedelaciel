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

## 2026-09-17 — `--tick-reach` is the second contract with the margin

The article now publishes two lengths outward, not one. `--frame-inset` says
how far the frame holds the text off the edge; `--tick-reach` says how far the
machine's corner ticks reach past that edge. `Sidenote.astro` subtracts both,
because a note has to begin outside everything drawn on the article's boundary,
and the ticks are now the outermost of those.

Registered, like `--frame-inset`, but for a different reason. `--frame-inset`
had to be registered so its `ch` resolved against the article's font rather
than the note's. `--tick-reach` is in `rem`, so that particular hazard does not
apply — what registration buys here is that a bad value falls back to the
initial `0` instead of poisoning the `calc()` that the note's `margin-right`
is built from. An unregistered custom property carrying anything but a length
takes the whole expression down with it, and the symptom is a note in the
wrong place in one layout only.

Neither the ticks nor the rail slug needs a print override, and that is the
existing pattern rather than an omission: both are declared inside
`framed-article`, which is `@media screen and (min-width: $wide)`. Paper never
matches a `screen` query, so it never sees them, and `--tick-reach` keeps the
`0px` the base `article` rule gives it. A code block's ticks *are* turned off
by hand under `@media print`, because those are painted on the block itself
and no width query is holding them.

## 2026-09-17 — the rail slug is sized by its line box

`article::after` is set `writing-mode: vertical-rl`, which turns the line box
sideways: the line height becomes the slug's *width*, and that width has to
fit a gutter of 2rem less what the ticks already take. At the inherited 1.6 it
was 15.3px in a 19.2px band and overlapped the navbar by about 3px. `line-height: 1`
brings it to 9.6px, which centres with about 5px either side.

The content comes from `data-rail` on the article, written by md.astro, and is
read with `content: attr(data-rail) / ""`. The empty string after the slash is
the generated content's alternative text: without it the stamp is announced by
screen readers as if it were a sentence someone wrote.

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

## 2026-09-18 — the rail slug moved right and stood its characters up

Two changes to `article::after`, both asked for directly.

`right: calc(100% + …)` became `left: calc(100% + …)`. The right margin is the
better home for it: at the `wide` breakpoint the grid puts the whole gutter on
that side — `--left-col` computes to `0` until about 72rem — so on the left the
slug was squeezed into the body's 2rem padding, while on the right it has the
sidenote gutter to stand in. It sits in the band between 0.5rem and 2rem past
the corner ticks, which is exactly the clearance `Sidenote.astro` leaves ahead
of itself, so the stamp and the notes share a margin without touching.

`text-orientation: upright` is what stops the glyphs being turned on their
side. `writing-mode: vertical-rl` alone rotates Latin text ninety degrees;
`upright` keeps the column vertical but sets each character the right way up,
which is how a seal is cut and how the 書口 it imitates reads.

That changes what `letter-spacing` means: upright, it is the gap between
stacked characters rather than between letters of a word, and the 0.22em that
looked right in a rotated line of small caps made a very long ladder. 0.1em is
the equivalent. `line-height: 1` still sets the slug's width, for the same
reason as before.

## 2026-09-18 — the stamp prints, and needed a query of its own

`framed-article` is `@media screen and (min-width: $wide)`, so everything
declared inside it is screen-only by construction. That was right for the whole
machine layer while the rail slug named the page. It stopped being right when
the slug became a dateline: paper is the copy that most needs one, having been
separated from its address.

So the slug moved out of `framed-article` into `stamped`,
`@media screen and (min-width: $wide), print`. The two are no longer
complements — `framed-article` and `framed-title` still are, and `stamped`
deliberately overlaps both — which is why it is a third mixin rather than a
condition bolted onto an existing one.

Nothing about the rule itself had to change. `left: calc(100% + var(--tick-reach) + 0.5rem)`
works on paper because `--tick-reach` is `0px` there: the offset collapses to
half a rem from the text block, which is the clear strip the centred column
leaves. One offset, two media, no print-only override.

## 2026-10-05 — symmetric columns, a scrolling contents

At `wide-sidebar` (now 80rem: the user chose raising it over squeezing both
columns to ~10rem at 72rem) the grid is `1fr content 1fr`, and the sidebar is
exactly `--sidenote-width` wide, `min(14rem, gutter/2 − 2.2rem)`. The sidebar
is capped at the window's height, and the contents scroll inside it, with
`$toc-room` padding drawn back out by negative margins so that the vines,
rings and tracker hanging past the list aren't clipped. The ends fade by a
scroll-driven animation (`toc-ends`) behind `@supports`: without
`animation-timeline` it would be a 0s animation filled to its last frame,
fading the top for good.

Known, and not from this change: between 60rem and 80rem the sidebar, and so
the navbar, is hidden entirely (since "Sidenotes 1"). Raising the breakpoint
widened that gap from 960–1152px to 960–1280px.

## 2026-10-06 — brushed rows and quotations

Each table row's stroke is `tr::after`, absolutely positioned with
`tr { position: relative }`, and straddles the row's bottom edge by half its
band. It is global, so Tumblr bodies get it too; the popover's ledger is
built from spans, not a table, and is unaffected. Even body rows switch the
mask to `across-b` by including `brushed` again, which repeats the
size/position longhands. That costs a few bytes, and it keeps the mixin the
only place those longhands are written. `tr::after` in Safari has not been
checked: the suite runs Chromium only.

A blockquote is `min-block-size: 2lh` so that a one-line quotation still has
room for both the head and the tail. Under 6 bands (42px) they would
overlap.

## 2026-10-06 — brush bullets, task lists, inline elements

Bullets apply only to `ul:not([class])`. GFM classes a task list
`contains-task-list`, and the selector is how the task squares and the brush
marks keep out of each other's way. Depth is counted by nesting
`ul:not([class])`, so a task list nested inside a bulleted list does not
shift the depths.

The marker is hidden with `list-style-type: ""` rather than
`list-style: none`, because WebKit drops list semantics under `none`. The
content spec asserts the computed `""`.

Task items lay out inline with a hanging indent (`padding-left` plus a
negative `text-indent`), not as the specimen's flex row. GFM puts the words
straight into the `li` next to the input, with no span, so under flex every
inline child (a link, emphasis) would become a flex item of its own.

The `mark` swipe is a background with its colour baked in (`--swipe`, from
colors.scss), not a mask. A mask on `mark` would clip its words.

## 2026-10-06 — code in the woodblock frame

`pre` drops its corner ticks and its print override, which existed only to
remove those ticks on paper, and wears `ornaments.frame` (3px, 3px, 1px)
printed on `raised`. The padding grows by the frame's 4px. The left padding
is smaller because the line-number gutter supplies the rest. `.said` (the
live regions' visually-hidden style) moved here from CopyLink.svelte now
that CopyCode needs it too.

## 2026-10-06 — `--rail-band`

The slug's `left` offset (was 0.5rem past the ticks) and the sidenotes'
standoff (was 2rem past them) were two numbers that had to agree by hand. Both
now read `--rail-band` on `article`: the slug centres itself in it (it is 1em
wide, set sideways at line-height 1), and Sidenote.astro begins notes at its
far edge. 1.4rem leaves 0.4rem either side of the 0.6rem slug. It is set under
`stamped`, which is the same set of media where notes go to the margin.
annotation.spec's "rail slug clears the frame and the notes" guards both sides.

## 2026-10-06 — `--rail-band` became `--margin-gap`, 0.2rem

Superseded the entry above within the hour. The user tried 0rem, settled on
0.2rem, then asked for the slug to move off the ticks. A 0.6rem slug cannot be
centred in a 0.2rem band, so the slug no longer centres: it and the notes both
begin `--margin-gap` past the ticks. They share a left edge, so a note set
level with the top of the article can run alongside the slug.
annotation.spec's "rail slug clears the frame and the notes" was written for
the old arrangement and is expected to fail; the user deferred tests to an
end-of-session pass.

## 2026-10-06 — the sidebar between `wide` and `wide-sidebar`

It was `display: none` there, so the navbar vanished from 60rem to 80rem. It
now sits in grid column 2 above the article and keeps its narrow, horizontal
layout (its container query reads the sidebar's width, which is the measure).
The sidebar TOC is hidden by its own default rule; the portrait TOC covers
that tier. No browser profile is in that range, so navbar.spec sets its own
viewport (1100px) for the test.

## 2026-10-06 — portrait TOC drops quicker and resolves its entries

Asked for directly. `toc.$drop`/`$lift` (320/200ms) replace `$unfold`/`$fold`
for the dropdown. Top-level entries resolve via the same mixins as section
entries (`toc.resolvable`, `toc.resolving`), staggered `toc.$drop-step` apart
and capped at 0.75 of the drop. No unresolve on close: print shows the list
expanded while the checkbox is unchecked, and a leaving animation would leave
the entries gone there.

Follow-up: the grid's `gap: 2rem` was also a row gap, which put the navbar
2rem above the article in that tier. The grid now sets `column-gap` only, and
the sidebar stands `$tick-reach` off the article, just clear of its corner
ticks. On a narrow page it sits flush, since the title wears the frame there
and has no ticks.

## 2026-10-06 — no `a:visited` rule

`a:visited { color: inherit }` (0,1,1) outranked `.copy-link`'s muted colour
(0,1,0), so an address lit up in full ink once its `#…` had been visited,
which copying does by putting it in the address bar. It was redundant: `a {
color: inherit }` is an author rule and already beats the browser's visited
colour, whatever the specificity. Not covered by a test: browsers report
unvisited styles to `getComputedStyle` for privacy, so a test cannot see it.

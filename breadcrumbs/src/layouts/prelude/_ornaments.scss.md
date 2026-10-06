# \_ornaments.scss

## 2026-09-17 — one brush stroke, any colour, any width

The design asks for a tapered horizontal in five places: under the front
matter in vermilion, under each `h1` in ink, as `<hr>`, above the bibliography,
and potentially anywhere else. The obvious implementation — an SVG file per
colour — would need two copies for the two schemes, three with print, and would
go stale the moment the palette moved.

It is a **mask** instead. The SVG is a filled path with no colour of its own,
used as `mask` over `background-color: currentColor`, so one shape takes any
ink the cascade gives it and the scheme switch costs nothing. The path lives in
a 400 × 20 box with `preserveAspectRatio="none"`, so it stretches to any width.

The mixin takes a `$ratio` and sets `aspect-ratio` rather than a height, which
is what keeps the stretching honest: a call site can only choose how long the
stroke is, never how squashed. Longer rules get a larger ratio, because a sweep
of the same brush is relatively thinner than a flick of it. The visible ink is
about a quarter of the box's height, so a rule's actual weight scales with its
length the way brushwork does.

## 2026-09-17 — `border-style: double` cannot draw 文武線

The frame around the text block is a thick rule outside a thin one with a
channel of paper between. `border-style: double` divides its width into three
*equal* parts, so it can draw thin/thin but never thick/thin, at any width.

Two stacked inset shadows can, because the first in the list paints over the
second: a ring of the element's own background at `$gap`, then a ring of rule
colour at `$gap + $inner`. What survives, reading inward from the border, is
`$gap` of paper and `$inner` of rule.

The consequence to remember is that `$ground` has to be the element's *own*
background — the article's frame sits on `--color-background`, the popover's on
`--color-raised`. Passing it in rather than assuming one is why the same mixin
draws both.

`frame` also takes an optional `$cast` shadow so a floating frame can hang an
outer shadow off the same property. A `null` default works because Sass omits
nulls when it serialises a comma list, so the popover gets three shadows and
the article two, from one declaration.

## 2026-09-17 — corner ticks are eight gradients, not four elements

The machine layer's bounding box is a right angle at each corner with the
edges left open. The obvious implementation is four absolutely positioned
children, each with two borders and two suppressed — which is what the
prototype did, and it is wrong here for three separate reasons.

It needs four boxes in the layout, and the figure has to go on a
pseudo-element (`article::before`), which gets exactly one. It cannot be put
on an element whose overflow is clipped — `pre` scrolls sideways, so anything
drawn outside it disappears. And a child of a scroll container scrolls with
the content, so the ticks on a code block would slide off as you read it.

Eight `linear-gradient` backgrounds on one element solve all three at once. A
gradient from a colour to itself is a fill, so the arms take
`var(--color-signal)` like anything else and cost no asset. `background-size`
gives each arm its length and weight, `background-position` puts two at each
corner, and `background-attachment` defaults to `scroll`, which — despite the
name — pins the paint to the border box while the contents move underneath.

Only the four background longhands are emitted, never the shorthand, so a call
site keeps the `background-color` it already had. `pre` and `.link-popover`
both rely on that.

`$inset` exists because of one call site and is worth the parameter. `frame`
draws with inset box-shadows, and those paint *over* the background — so ticks
laid on the padding edge of an already-framed box are painted out entirely and
silently. The popover is 4px in: two of channel, one of inner rule, one of air.

## 2026-09-18 — `corner-ticks` picks its far edge with `@if`, not `if()`

Sass 1.93 deprecated the comma form `if($cond, $then, $else)` in favour of a
CSS-shaped `if(sass($cond): $then; else: $else)`. The modern form compiles and
is the upstream suggestion, but Prettier does not know it yet: it reflows the
call across three lines and appends a trailing comma inside the parentheses,
so the result reads like the deprecated argument list it replaced. A
`@if`/`@else` statement is not deprecated, formats stably, and every SCSS
reader already knows it, so the branch is written out instead.

`$far` has to be seeded at `100%` before the `@if` rather than assigned in
both arms: a variable first written inside a block is local to that block, so
an `@if`/`@else` pair would leave `$far` undefined at the point of use.

The branch itself is still load-bearing. `$inset` defaults to the unitless
`0`, and `calc(100% - 0)` is invalid CSS — a percentage and a plain number are
not the same type — so the no-inset case has to reach `100%` without the
`calc`.

## 2026-09-23 — `glass` replaces `frame-light`: a hard pane inset from its ticks

`frame-light` had one call site, the link popover, and the popover is no longer
a slip of paper. It is a pane of machine glass — the reference is the industrial
overlays of Person of Interest's Samaritan and Mirror's Edge Catalyst, built with
the technique in Josh Comeau's "Next-level frosted glass with backdrop-filter".

**What was tried and rejected, because the reasons are the design.** A
`signal`-tinted fill read as a green card. A fill lit by a gradient with a halo
read as a rounded, glowing object. A flat opaque plane inside the 文武線 read as
a card with a bezel — paper needs a frame to say where it ends, glass does not.
An 86% fill read as not translucent at all. A pane whose edges faded out under a
mask read as soft, where this idiom is hard-edged.

**The pane stops `$gap` short of the ticks.** The ticks sit at the element's
corners; the glass is a rectangle `$gap` inside them. The element is therefore
larger than the visible glass, which is Comeau's point about extending the
backdrop: `backdrop-filter` only samples what is directly behind its element,
so a blur that ends at its own edge thins out there. Here it has `$gap` of page
to draw on past the cut.

**The cut is a mask of the rectangle *plus* the tick arms.** A mask that was just
the rectangle would trim the ticks off with the glass, since they are painted on
the same element (it has to be the same element — the popover scrolls, and a
background is the one thing pinned to a scroller's box). Both the paint and the
mask are laid out by `tick-arms`, so they cannot drift apart; `corner-ticks` now
uses it too.

**No outer box-shadow.** `mask-clip` is the border box, so a cast shadow is
masked away entirely; `glass` takes no `$cast` rather than silently ignoring one.

**The pane has no hue, and the blur does not saturate.** Every surface token in
the ink scheme leans faintly green, so a plane mixed from them came out green in
dark mode; `oklch(from … l 0 h / 70%)` keeps its lightness and drops its chroma.
A `saturate()` in the backdrop filter did the same damage from the other side,
pulling the page's own hue up through the glass, and is gone. A 1px white lit
edge along the top, after Comeau's glass-thickness edge, was barely visible on
paper and a hard white rule on ink; it is gone too.

## 2026-10-05 — the brush rules became vines

`$stroke` and `brush-rule` are gone. Every rule is now a flowering vine drawn
by src/layouts/prelude/vine.mjs, one per place in `$vines`, called through
`vine-rule($name)`. Each name has a fixed seed, so a place always shows the
same vine. The width lives in `$vines` beside the ratio, not at the call
site, because the drawing's density and pen weight were tuned for that size.

**How the design got here, since each rejection is part of it.** The user
first asked for watercolour strokes. Four filters were tried on the old 橫:
pressed (bloomed edge), wash (dried rim, pale interior), granulated, and dry
wash (the logo's bristle edge plus 飛白 streaks); dry wash won. They then
asked for "vines with flowers instead of a straight line".

1. A brush-stroke vine with one *Wisteria* or *Vicia* raceme. Rejected: the
   user wanted "more flowing and rounded, a la medieval European manuscripts".
2. A rinceau: an even sine wave with a rosette, raceme or trefoil at each
   bend. Rejected as "still a bit regular". The reference became the white
   vine-stem idiom and a painted ivy-and-rose border the user supplied, with
   "a single vine, not an illustrated section".
3. The ivy vine-stem, which the user loved, after three refinements:
   - "a liiitle straighter";
   - centred rules taper at both ends rather than being "oddly asymmetrical";
   - "no curlies on top of existing curlies".

**Two-tone, so colours are baked per scheme.** The user chose separate vine
and flower colours (`signal` and `accent`). A mask carries only one colour, so
each scheme bakes its own copy, as `texture()` does, and `apply-theme` sets
`--vine-<name>`. The copies are files, not data URLs: twelve SVGs of
15–43 KB inlined into the stylesheet would block every page's render on
hundreds of KB of CSS. See breadcrumbs/src/integrations/vines.ts.md.

## 2026-10-05 — the table of contents' drawings live in `$vines`

The TOC's measures (`$toc-pitch`, `$toc-vine-width`, `$toc-column`,
`$toc-gap`, `$toc-reach`, `$toc-elbow`, `$toc-shoot-clear`) sit next to
`$vines` because the drawings are made to them: the shoot's reach is computed
here from the distance between the vine's column and third-level words. The
plan's `$toc-chev` became `$toc-column`, since there is no chevron any more.

Sections of up to `$toc-counted` (20) entries get a vine drawn to their
length, `(n − 0.3) · pitch / width`, so the curl sits beside the last entry.
Longer sections, and Tumblr's (whose counts are unknown at build time), get
`toc-long`, faded where the list ends. Seeds are `11 + min(n, 12)`, so the
hanging strips for n ≥ 12 are identical files and deduplicate by content hash.

The host functions are called through `-drawn-by()`, which fails the build if
the integration isn't loaded; otherwise Sass writes `vine(...)` out as an
unknown CSS function and the page silently shows nothing.

## 2026-10-06 — `$strokes` and `brushed()`

`brushed($name)` takes only the name. The plan had `brushed($name, $axis)`,
but each stroke is drawn along one axis, so the axis is stored in the
`$strokes` entry and an across stroke can't be laid down a column. The body
layer is `100% - 2·end + 1px` wide, overlapping each end by a pixel, which
is how the specimen hid the seams. The call site supplies `--band`, the
size, the position and the ink, so the same mixin serves table rows,
quotations and sidenotes.

## 2026-10-06 — `$brush-marks` and `brush-mark()`

The 點 and 橫 are hand-kept paths from the specimen, not drawn by brush.mjs:
at bullet size the generated stroke's grain is lost, and these read better.
`brush-mark()` inlines them as data URLs, about 300 bytes each. A fill colour
is written as `rgba()` with commas, because a hex `#` would end the data URL.

## 2026-10-06 — heading and title vines

The title vine is now `centred` and centred under the front matter. The
heading vine is 13.5rem, about a third of a wide article's 80ch measure
(≈653px at 16px root), at ratio 10 so it stays about as tall as the old 5.5rem
one. It is a fixed length and not a percentage: a percentage would thin it to
a hairline on narrow screens, and the spec gives each place's vine a fixed
size. A vined h1 has a 0.2rem bottom margin (other headings have 0.6rem), since
the vine already closes it off.

The title vine then took a horizontal rule's size (13rem, ratio 8), keeping
seed 1 so it is still its own drawing. In `$vines`, write comments inside an
entry: Prettier mis-indents an entry that has a comment above it.

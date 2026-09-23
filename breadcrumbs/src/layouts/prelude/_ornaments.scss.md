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

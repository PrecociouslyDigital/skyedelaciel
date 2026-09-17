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

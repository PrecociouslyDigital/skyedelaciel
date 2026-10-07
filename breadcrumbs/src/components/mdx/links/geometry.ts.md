# geometry.ts

## 2026-10-03 — the column/banner crossover is derived, not chosen

An image goes in whichever box crops less of it, both boxes covered with
`object-fit: cover`. For an image of aspect `a` in a box of aspect `b`, the
share kept is `min(a, b) / max(a, b)`. Between the column's aspect
(7.5 / 16 ≈ 0.47) and the banner's (26 / 7.5 ≈ 3.47), the column keeps `bc / a`
and the banner keeps `a / bb`. They are equal at `a = √(bc · bb)` ≈ 1.27. So
the crossover follows from the boxes: change a box and it moves with it, and
`tests/unit/geometry.test.ts` checks the choice over aspects from 1/32 to 32.

The boxes are nominal. The real image is inset by `$glass-gap` (6px) on the
sides that touch the glass edge, and the column's real height is the pane's
actual height, which is at most `MAX_HEIGHT`. The cap is the extreme box, and
the one a decision has to hold for.

`sourceWidth` sizes the copy so that, scaled to cover its box at its cap, it
still has two device pixels per CSS pixel. A wide image covering the narrow
column is limited by height, which is why it is `max(width, height × aspect)`.
`placeImage` never asks for more than the original's width.

## 2026-10-03 — the column shows its image whole; the crossover didn't move

On review, column images shouldn't be cropped. Each box now has a `fit`: the
column is `contain`, the banner stays `cover`. That looked as if it would break
the placement rule, since a contained image keeps all of itself and would
always win on "share kept". It doesn't: the share of the *box* a contained
image fills is the same `min/max` of the two aspects as the share of the
*image* a cover crop keeps. So `kept` became `match`, the property test reads
the same, and the crossover stays at ≈1.27. The column loses empty box where
the banner loses cropped image, and the image goes where it loses less.

`sourceWidth` follows `fit`: `max` for cover, `min` for contain. A tall image
contained in the column is drawn narrower than the column, so it needs a
smaller copy, not a bigger one. The test checks both directions: at least
`DENSITY` pixels per CSS pixel, and not more than one pixel of rounding past
that.

The banner's box is its *resting* height. It gives way to `BANNER_MIN_HEIGHT`
as the text scrolls (see Link.astro.md), and a smaller box of the same width
needs no more pixels, so the resting box is the one to size the copy for.

**`tooSmall`: images are never enlarged.** `placeImage` caps the copy at the
original's width, but nothing stopped CSS from drawing that copy bigger. The
bibjson page's OpenGraph image is a 28×30 logo, which the column drew at
114×122 and which set the pane's height. An image narrower than its
`drawnWidth` is now left out. The test is the property that matters: whatever
`tooSmall` lets through has a copy at least as wide as it is drawn. The
threshold is 1× rather than `DENSITY`, so a modest image still shows on a
high-density screen, just less sharply.

## 2026-10-03 — the pane is built around a column image

Showing the portrait whole at a fixed column width left it ending partway down
the pane, with bare glass under it. "Whole" and "top to bottom" together leave
one free variable: the pane's height. So `placeImage` returns the size a
column image is drawn at (`drawn`, in CSS pixels), and `PreviewImage` is now a
real union, since only a column carries it. Link.astro sets the column track to
that width and the pane to that height, each plus the glass's inset.

The column box grew to 9 × 15 rem. It is wider so that portraits don't make
short panes: Wang Xizhi's is about 12rem tall, against 10 at 7.5rem wide. It
is a rem shorter than `MAX_HEIGHT`, so the image plus 6px of glass above and
below still fits under the cap. The crossover is still derived, and moved to
≈1.44 with the wider box.

The cost is that a near-square image picked for the column makes a short pane,
since the pane is as tall as the image. The Wikipedia logo (120 × 110) would
make a pane about 8.5rem tall. `tooSmall` now drops it, as a 144px-wide
drawing would enlarge it.

## 2026-10-06 — `match` is `suitability`

It shadowed ts-pattern's `match` in any module that wanted both.

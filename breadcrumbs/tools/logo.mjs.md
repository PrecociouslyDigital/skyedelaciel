# logo.mjs

## 2026-09-17 — the served mark is generated, not drawn

`public/logo.svg` used to be an Inkscape save: uniform-width stroked arcs held
together by fourteen `<mask>` elements, one per interlace crossing. Three things
were wrong with that, and all three are structural rather than cosmetic.

**The masks are fragile.** See the entry in `public/logo.svg.md`: Inkscape's
powermask LPE emits masks with no region, SVG falls back to a default that
resolves against the viewport, and the layer translate moved it — so two thirds
of the artwork disappeared. The fix had to be reapplied by hand after every
save from Inkscape.

**Strokes and masks do not take a colour from CSS.** The dark scheme showed a
black `<img>` on a near-black page. Painting the mark as a CSS mask over
`var(--color-accent)` fixes that, but masking needs a shape, and a masked
stroke is not one. Every stroke here is therefore a closed filled outline, and
the whole file is one `fill="currentColor"`.

**The viewBox was a tight bounding box of stroked geometry**, not a square on
the flower's axis, so the mark sat off-centre in anything square — which the
seal in the navbar is.

### The geometry, recovered from the Inkscape file

Six circles of radius r, whose centres sit on a ring of radius r at 0°, 60°,
… 300°: the seed of the flower of life, so every circle passes through the
centre O. Petal k is the 240° arc of circle k, from angle 60k + 60 to
60k + 300 about its own centre. The 120° it omits is the cap furthest from O,
which is why the six arcs meet tip to tip in a rosette and all six pass through
O at their midpoints.

Two consequences fall out of that and are worth writing down, because the
interlace depends on both:

- Adjacent petals (60° apart) touch only at their **endpoints** — petal k's
  start is petal k+1's end. They do not cross.
- Petals two spokes apart (120°) cross at exactly one point besides O, and that
  point is the **centre of the petal between them**.

The hexagon is flat-topped, circumradius 1.477r, and thinner than the petals.

### The interlace

Petal k passes under the petal two spokes behind it and over the one two ahead,
which gives every petal exactly one gap. An under-pass is a stretch cut out of
the ribbon's parameter interval, wide enough to clear the other ribbon's width
where it passes plus a margin, divided by the sine of the angle the two meet
at — a shallow crossing needs a longer gap. Both cut ends taper, so a gap reads
as the brush lifting rather than as a slice.

All six petals also meet at O, where six strokes cannot be woven at all: any
consistent over/under assignment around a six-way crossing contradicts itself.
The drawn mark simply pools there and so does this one, so the crossing search
keeps only the outer intersection of a pair. That pooling is also why the brush
profile has a waist: a petal is at about 60% of its full width where it passes
through the centre, which keeps the pool a knot rather than a disc.

### Why the brush presses at both ends

The first pass gave each petal a calligrapher's stroke — press on landing, long
taper to the lift. Six of those rotated about one point read as a pinwheel, not
a flower; the mark lost the symmetry that makes it a mark. A 橫 pressed at both
ends and thinned at the waist keeps the rosette balanced and is, as it happens,
how the stroke is actually written.

### What the drift test protects

`tests/unit/logo.test.ts` asserts that `renderLogo(params)` equals the committed
file, byte for byte, for both outputs. Generated files that can be edited by
hand get edited by hand, and the next run of the generator silently throws that
work away. Committed ≡ generated makes both halves of that impossible: an edit
to the SVG fails, and a change to the parameters without re-running
`node tools/logo.mjs` fails too.

The generator also refuses to emit a gap narrower than the distance between
samples, which would fall between two of them and leave the ribbon whole — an
interlace silently undone, and the one failure here that would otherwise look
like a rendering artefact.

### The Inkscape master

Kept as `src/assets/logo.inkscape.svg`. It is out of `public/` because
everything in `public/` is served, and serving a 39 KB Inkscape save alongside
the 24 KB generated one invites the two to drift.

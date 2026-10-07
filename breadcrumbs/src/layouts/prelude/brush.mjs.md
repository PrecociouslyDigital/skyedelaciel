# brush.mjs

## 2026-10-06 — productionised from the prose specimen's prototypes

The model is a line-for-line port of the specimen's `plate-brush.mjs`, which
was itself a port of ~/data/logo-brush.py. What changed on the way in:

- It draws from `chance` (chance.mjs), not its own mulberry32. `uniform` is
  `between`, `randint(lo, hi)` is `lo + integer(hi - lo + 1)`, and
  `choice([-1, 1])` is `sign()`. Seeds can therefore be strings: figure ids
  and stroke names. The drawings differ from the specimen's, but they are
  the same kind of drawing.
- The streaks of the dry tail draw from a second `chance` seeded from the
  first, as the prototype did, so that adding streaks does not shift
  everything drawn after them.
- `strokePiece` crops each piece's polygons to its own stretch
  (Sutherland–Hodgman against a slab, a unit past each edge). The
  prototype's pieces each carried the whole 1200-unit path inside a
  cropping viewBox, about 10 KB apiece; cropped, a head is under 1 KB.
  Cropping can leave a polygon empty, so `pathData` drops anything with
  fewer than three points before simplifying.
- `strokePiece` returns `{ svg, box }`, where the box is the piece's size in
  bands. `brushed()` in _ornaments.scss reads the head's box for how long
  the ends are, so the 3:1 is stated only here.
- The specimen's `back` and `up` (reversed) strokes are dropped. Nothing in
  the plan uses them.

Hash pins in brush.test.ts wait until the user has seen the strokes on the
dev server and approved them.

## 2026-10-06 — `plated`

The size of a plate was `width + 2 * PLATE_PAD` in remark-figures.ts (twice)
and Figure.astro. `plated(length)` says it once.

## 2026-10-06 — internals unexported

`END`, `PLATE` and `pathData` were exported but only read inside brush.mjs.
The same went for geometry.ts's `PANE_*`/`COLUMN_*`/`BANNERED_*` and `Fit`,
cite.ts's `cslYear`, sections.ts's `newestFirst` and tools/logo.mjs's
`LOGO`/`FAVICON`.

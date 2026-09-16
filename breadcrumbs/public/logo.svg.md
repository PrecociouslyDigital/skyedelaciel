# logo.svg

## 2026-09-15 — artwork was clipped at the lower right

Inkscape's powermask LPE emits `<mask maskUnits="userSpaceOnUse">` with no
`x`/`y`/`width`/`height`. SVG then falls back to the default region
`-10% -10% 120% 120%`, and under `userSpaceOnUse` those percentages resolve
against the **viewport** (542.33 x 620.48) while being *placed* in the
referencing element's user space.

Every layer here carries `transform="translate(-228.61913,-189.68411)"`, so the
default region landed at viewBox x -282.8..368.0, y -251.7..492.9 — roughly the
top-left 68% x 79% of the drawing. Everything outside that was masked away: the
lower-right petals and most of the hex.

Fix: explicit `x="0" y="0" width="1000" height="1000"` on all 14 masks (the
Inkscape page bounds, which contain the drawing's 228.6..770.9 x 189.7..810.2).

Re-saving from Inkscape will regenerate the masks and drop the region again.
If that keeps happening, the durable fix is to bake the layer translate into
the geometry *and* the mask content so the default region lines up on its own,
or to generate the served file from the Inkscape master via a build step.

Verified in Chrome and librsvg; `viewBox` itself was always correct — it is a
tight bbox of the artwork, so the logo has no built-in padding.

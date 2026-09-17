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

## 2026-09-17 — the served file is now generated

`public/logo.svg` is written by `tools/logo.mjs` and is no longer an Inkscape
save, so the mask-region bug above cannot recur: the generated file has no
`<mask>` elements at all. The Inkscape master moved to
`src/assets/logo.inkscape.svg`, out of the served directory.

`public/favicon.svg` is the same generator's second output, drawn for sixteen
pixels in a tab: heavier, cropped close, and with the hexagon dropped. At that
size the frame becomes a ring of specks that fills the gaps between the petals
and turns the mark into a blot, while the rosette alone still reads as a
flower. `md.astro` had been linking that path since before it existed.

See `breadcrumbs/tools/logo.mjs.md` for the geometry and the interlace rule.

`public/favicon.ico`, for browsers that still prefer one, was the old mark with
the same clipping bug — cropped at the top left, off its own axis. It is now
derived from `favicon.svg`, and being a binary it is the one file here the
drift test cannot check, so the recipe lives here instead:

```
rsvg-convert -w 256 -h 256 public/favicon.svg -o /tmp/icon.png
magick /tmp/icon.png -define icon:auto-resize=48,32,16 public/favicon.ico
```

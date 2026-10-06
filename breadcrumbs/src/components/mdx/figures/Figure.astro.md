# Figure.astro

## 2026-10-06 — geometry through custom properties

The figure publishes `--plate` (the drawing's URL), `--plate-width` and
`--plate-pad`, unitless px, in its inline style. figures.scss derives
everything from them: the width is `min(100%, plate px)`, and the padding is
`100cqi · pad / plate-width`, so a plate shrunk to fit a narrow column keeps
the frame's proportions. `PLATE_PAD` lives in brush.mjs, next to the frame
it clears, so the plugin that draws the plate and the component that lays it
out read the same number.

The credit slot is forwarded only when there is one (`Astro.slots.has`),
because a forwarded empty slot still counts as present in Caption.

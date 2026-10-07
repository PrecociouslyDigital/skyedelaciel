# pen.mjs

## 2026-10-06 — what the drawing modules share

`TAU`, `lerp`, `smoothstep`, the `Point` type, `nth`/`last`, arc-length
accumulation and the SVG root were each written in vine.mjs and brush.mjs (and
the root in patchwork.mjs too). They live here now. tools/logo.mjs keeps its
own: it works in `{x, y}` points.

Number formatting did not move. vine.mjs writes relative moves in tenths with
leading zeros dropped, brush.mjs writes one decimal with `.0` dropped, and
vine's viewBox three decimals; they are different formats on purpose (path
size against fidelity), and unifying them would change every drawing.
Everything that did move was checked against the built drawings and masks,
which are byte-identical.


## 2026-10-06 — Fitted-chroma cases follow colors.scss

The pigment and ground literals had drifted: the old attention pigment
`#907f93` (since restored in chroma as an oklch), a red no scheme uses, and
two grounds no longer in `$grounds`. They are now the three pigments and the
light and dark `background`/`raised` grounds. Reading them out of colors.scss
by Sass was tried and does not work: colors.scss calls the vines
integration's custom functions at the top level, which a bare compile lacks.


## 2026-10-06 — the mark's rewrite counts as growth

The navbar mark's strokes lift and are laid down again over `$grow-limit`
(600ms) through `motion.grow`. The test classified growth by `.toc`,
`.receipt-word` and resolving animations only, so it read the rewrite as a
120ms-limited transition that ran long. `.logo` joins the growing selectors.

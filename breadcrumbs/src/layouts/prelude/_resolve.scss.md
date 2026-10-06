# _resolve.scss

## 2026-10-06 — extracted from toc.scss

The contents' entries and the copy receipt both use it. It contains mixins
only, like _ornaments.scss. prelude.scss includes `strips` on `:root` and
`keyframes` once at the top level, so the data-URL strips (about 6 KB) are in
the stylesheet once, not once per user. A user brings its own patch element
and names the keyframes through `motion.grown`, which already handles
reduced motion and the 600ms limit.

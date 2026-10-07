# _resolve.scss

## 2026-10-06 — extracted from toc.scss

The contents' entries and the copy receipt both use it. It contains mixins
only, like _ornaments.scss. prelude.scss includes `strips` on `:root` and
`keyframes` once at the top level, so the data-URL strips (about 6 KB) are in
the stylesheet once, not once per user. A user brings its own patch element
and names the keyframes through `motion.grown`, which already handles
reduced motion and the 600ms limit.

## 2026-10-06 — a pane resolves too

The link popover resolves as a picture: a field of blocks over the whole pane
(`--blocks-field`, one 16×16 tile scaled down per stage via `mask-size`, so
lines don't repeat a row the way stacking the line strips would) and a stepped
`filter: blur` on the pane's children. Coarse blocks are 1em, twice the line
strips', because at 0.5em a pane read as noise rather than a picture. A veil
`::before` with `backdrop-filter` was tried first: nested inside the glass's
own `backdrop-filter`, Chromium blurred the image but barely touched the text.
The stage boundaries are shared Sass variables so the four sequences can't
drift apart.

## 2026-10-06 — a pane resolves part by part, through a quilt

Replaced the whole-pane field. Each part of a popover (image, title, meta,
summary, ledger) is a frame (`part`: an `::after` of blocks) around a picture
(its children, blurred). The blocks can't sit on the blurred element itself,
because `filter` blurs an element's own pseudo-elements, and the user asked
for hard edges.

The coarse stage is a quilt from patchwork.mjs: a 16×12 tile of 1.75rem
cells pieced into patches of up to 3×2, laid down over 6 cumulative frames.
Arrival and departure use the same quilt with different shuffle seeds, so
leaving is not arriving reversed. Medium and fine are the *whole* quilt at
½ and ¼ scale. The 16×16 random field used before read as noise beside the
quilt. A 12×8 tile visibly repeated across the 26rem pane at ½ scale.
Cost: 12 data URIs, ~9.4 KB raw, ~0.8 KB gzipped.

Timing is in ticks of 15 per part (6 for the quilt, 2 + 2 for the finer
stages, 4 for the last blur), so durations scale without retuning. Link.astro
staggers parts by `--part` (35ms in, 15ms out). The user wanted ~300ms in
total and was fine with it being faster than the eye can follow.

## 2026-10-06 — the resolve mixins live here

`resolvable`/`resolving`/`unresolving` were toc.scss's, and receipt.scss had
a word-for-word copy of all three for COPIED. They are here, generic:
`resolvable($inset, $offset)` lays the patch, and the contents' entry keeps
its own geometry as `toc.resolvable-entry`. `$strip` names the 8em the blocks
are cut in. The patch's element is no longer made `position: relative` by the
mixin, because the receipt's word is absolutely positioned and the entry
says so itself. The receipt now also gets `pointer-events: none` on its patch,
which its word already had.

## 2026-10-07 — the words lose their blur

The words' last stage was `filter: blur(1.6px)` easing to none. Interpolated,
the blur passes through many strengths, and Skia Graphite builds a pipeline
per blur kernel size (1DBlur4/8/12, 2DBlur12/28 in a trace), in more than one
sampling variant each: about 8 pipelines compiled on the contents' first
unfold, ~75 ms each with a cold Metal shader cache. Holding the blur at one
strength and snapping it off did not help measurably; removing it did, and
with it the later sections' first unfolds stopped hitching. The words now
fade in by `-webkit-text-fill-color` alone. The panes' picture blurs (5, 2.5,
1.2 px) are untouched. See breadcrumbs/src/layouts/prelude/vine.mjs.md for
the measuring setup.

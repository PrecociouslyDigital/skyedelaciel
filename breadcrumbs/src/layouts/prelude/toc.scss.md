# toc.scss

## 2026-10-05 — the trellis, in CSS only

Everything that grows does so without JavaScript, so the inline contents and
the nojs sidebar get it too.

- A section grows by `::details-content` `block-size: 0 → auto` with
  `interpolate-size: allow-keywords`; `content-visibility` is transitioned
  with `allow-discrete` so the content stays visible while it folds.
  `details` stays `display: contents`, and `::details-content` is a grid item
  spanning the row below the link (verified in Chromium before building on
  it). The summary stretches to the link's row, so the ring hangs from the
  row's foot even when the words wrap.
- The soft growing tip is a registered `--feather` length in a mask,
  transitioned with a delay. The mask uses `mask-clip: no-clip` and
  `repeat-x`: the vine overhangs its column by ~0.13rem, and a mask clipped
  to the border box cut it off.
- Section lengths reach CSS as `data-entries`, and one Sass loop maps each to
  its vine, ring strip and `--n`. The plan had inline `--section-vine`
  styles; the attribute keeps the set of drawn lengths in one place.
- Pieces are drawn for a vine on the left. On the right they are mirrored
  with `transform: scaleX(-1)` about their placement point
  (`transform-origin` is the point), which is why the blossom's growth
  animates the separate `scale` property rather than `transform`.
- Resolve was a set of SVG filters in an early prototype, and it hitched:
  filters on HTML can't go to the GPU and re-filter every frame. Now it is
  three mask swaps on a patch of `currentcolor`, then a brief blur. Arriving
  and leaving are the same keyframes under two names, because only a change
  of name restarts an animation. Arrivals fill backwards only, so an entry
  keeps no `filter` at rest; departures fill both and stay transparent, which
  the fold hides anyway.

## 2026-10-06 — Resolve moved out to _resolve.scss

The copy receipt (Headings, Figures) resolves its word COPIED in the same
way the contents resolve an entry. The keyframe bodies and the block strips
therefore moved to _resolve.scss. The strips are now `--blocks-*` on
`:root`, where they used to be `--toc-blocks-*` on each entry. The keyframes
are `resolve`, `unresolve`, `resolve-blocks` and `unresolve-blocks`, written
once by prelude.scss. The entry's own patch (`::after`, its inset and its
offset per `--i`) stays here, because it is measured against the contents'
pitch.

## 2026-10-06 — levels set apart

The first level is 1.15em and the second is set in from the vine side (1.5ch since a later request; 0.45rem at first),
because h1 and h2 entries read as one list. Everything in the trellis scales
by `$toc-scale` (1.1) in _ornaments.scss, both sidebar and inline, since the
spec calls the inline contents the same trellis mirrored. The 1.15em depth-1
type at 1.35 line height still fits inside the pitch; at around 1.3em the
padding that holds rows to the pitch would go negative.

Later the same day: at 1.15em the first level looked oversized, so it is set
in semi-bold at the shared size instead. This doesn't go against "coloured
rather than bolded" in toc.scss. That rule is about the current entry, whose
weight would change as the reader scrolls. This weight never changes.

Later still: the 1.5ch indent looked wrong and was removed, and the second
level lines up with the first again. A top-level entry gets its emphasis from
a rail instead: the `toc-rail` vine (a one-way `rule`, `blooms: false`) on
its `a::after`. It starts in the stem below the ring and runs out under the
words at a fixed length, as the article's heading vine does. Clipping it to
the words' width would cut off the curl at its tip. It grows with `clip-path`
on the section's unfold and fold timings, so a folded section and an entry
with no section show no rail.

Then the rail was removed too. It looked fine but felt wrong, so the first
level is now told apart by weight alone, at full bold (700).

Full bold read as too heavy, so the first level went back to semi-bold (600).

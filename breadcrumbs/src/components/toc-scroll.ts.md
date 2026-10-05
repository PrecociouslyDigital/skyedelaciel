# `src/components/toc-scroll.ts`

## 2026-10-04 — current by position, not by crossing

It used to be an IntersectionObserver that made a heading current when its top
crossed the top 5% of the viewport. Scrolling back up therefore left the later
section current until the earlier heading's own top came back into that band —
however much of the earlier section was on screen. On a Tumblr page of long
posts that lag was most of a post.

Now, on scroll (once a frame), the current entry is the last whose target
begins above the reading line. Over the last screenful of the page the line
slides from 5% down to the bottom of the viewport: otherwise a short last
section, or a short last post, could never become current because the page
ends first. The tracker measures the entry's `<li>`, so it encloses what the
entry unfolded (a post's tags, a heading's subsections).

## 2026-10-05 — tracker extents, settling, scrolling the sidebar

The tracker now has a horizontal extent. A whole section (more than one link
showing in the entry) reaches past the vine by `--toc-outset`; a single entry
hugs its words by `--toc-hug` and stops `--toc-clear` short of the list's
vine-side edge, clearing the blossom. All three are registered lengths in
toc.scss, so this file reads pixels and never repeats a measure. The
sidebar's vine is on the right, and nothing else runs this script.

Growth is followed by a ResizeObserver on the list and on each top-level
entry, plus `transitionend`: the last step of a fold (content-visibility →
hidden) changes no size, so the observer alone left a section-wide box behind
after folding.

`settle()` waits for every animation in the contents that runs on the
document timeline, then scrolls the contents (not the page) to bring the
current entry into view. The scroller's fading ends are an animation too, but
on a ScrollTimeline whose `finished` never resolves, so they are excluded by
timeline.

`track()` returns early while no link in the entry is visible: right after
`details.open = true` its contents are still `content-visibility: hidden`,
and measuring them threw, which aborted `makeCurrent` before `settle()`.

No template literals for pixel values: this script is inlined into the Tumblr
theme, and a minified `${v-f}` trips its `{Variable}` hazard check.

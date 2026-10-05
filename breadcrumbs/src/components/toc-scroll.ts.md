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

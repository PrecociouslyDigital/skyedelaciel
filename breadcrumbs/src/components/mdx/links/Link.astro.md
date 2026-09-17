# Link.astro

## 2026-09-16 — every link is wrapped, whether or not it has a popover

The component used to branch on `preview` and render the anchor twice, once
inside a `.link-wrapper` and once bare. Adding the printed citation would have
meant a third copy of the anchor and a second copy of the citation, so the
branch moved inward: the wrapper and the anchor are unconditional, and only the
popover is conditional. A wrapper with no popover costs an inline span.

## 2026-09-16 — what print puts where the link was

design.mdx asks for links to read as text on paper, cited into the bibliography
as "(Author, Year)" where there is an entry and printed as a bare address where
there is not. Two things follow.

A link has to know whether its *page* has a bibliography, which it cannot learn
from its own href — hence `LinkContext` in store.ts, which the route sets once
alongside the link metadata it was already setting.

And "where there is an entry" has to mean the same thing here as it does in
Bibliography.astro, or a link gets cited into a section that never lists it.
That rule is `isCitable` in cite.ts, which both now call. Internal links are
pages of this site rather than works, so they are never entries and always
print their address — which is why the spec's wording was tightened to say so.

## 2026-09-17 — the standoff belongs to a box, not to a margin

The popover floats clear of its link rather than touching it, and that clearance
was margin on the popover itself. Margin is not part of anything's hover target,
so the strip between link and popover belonged to neither: a mouse crossing it
left the wrapper, and the popover closed under the pointer on its way to being
read. `.link-popover:hover` looked like the guard against exactly that, but it
never was — the popover descends from the wrapper, so hovering it already counts
as hovering the wrapper. Nothing could hold the gap open because the gap was
nobody's.

So the clearance is now padding on `.link-popover-anchor`, the positioned box
the popover sits in. The same pixels, but they are part of a box that can be
hovered, which makes the travel from link to popover continuous by construction
rather than by beating the fade-out. The visible slip of paper stays
`.link-popover` — it is what the design tests measure, and what carries the
frame, the width cap and the scroll.

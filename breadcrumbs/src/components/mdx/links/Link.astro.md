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

## 2026-09-17 — the mark goes inside the anchor, and the fixture's dead link is internal

The provenance glyph is rendered *inside* the `<a>`, not after it. Two things
follow that would not if it were a sibling: it is underlined along with the
link on hover, so the link and its mark read as one object; and it travels
with the anchor wherever the anchor goes. It carries `aria-hidden` so it stays
out of the accessible name, and `display: none` under `@media print`, since a
printed link cannot be followed and saying where it would have gone is noise.

It changes nothing the resting-link tests measure: `tests/design/links.spec.ts`
reads `fontWeight`, `color` and `textDecorationLine` off the anchor's own
computed style, which a child span does not touch.

**Why `kitchen-sink.mdx`'s deliberately-unresolvable link points at
`/not-a-page` rather than at a dead external URL.** The fixture needs one link
whose mark comes out in `--color-attention`. The obvious choice is an
unreachable `https://` address, and it would break
`tests/design/links.spec.ts`: that file asserts every `http(s)` prose link
prints as `(Author, Year)`, and an unresolved external link has neither — it
is nonetheless citable, so it lands in the bibliography as a bare URL with
nothing to cite it by. An internal path to a page that does not exist produces
the same unresolved state (no entry at all), prints its address like every
other internal link, and is never a bibliography entry. It is also the more
honest fixture: a broken internal link is the thing the ochre mark is for.

## 2026-09-18 — the popover hides behind `visibility`, and fades one level down

Two facts about the entrance, and they are both about which element carries
which half of it.

**The hiding switch is `visibility`, on the anchor.** It used to be `display`,
and the fade declared alongside it never ran: the delays were staggered —
`snap((opacity, display), 120ms, (0.3s, 0.4s))` — so the opacity transition
spent its first 100ms on an element that was still `display: none` and the box
appeared at around 0.83 opacity with 20ms left to run. `display` cannot be faded
from on its own: the box is not rendered before the flip, so there is no
before-change style to transition out of, and making it work needs
`@starting-style`, `transition-behavior: allow-discrete`, and a second
`transition-delay` in the hover rule matched to the property list *by index*.
`visibility` needs none of that. The box stays rendered while hidden, the
property interpolates to `visible` at the start of the transition and back at
the end, and one delay covers entry and exit alike. It still takes the whole
subtree — the standoff padding included — out of the accessible tree, out of
find-in-page and out of hit testing, which is everything `display: none` was
doing here.

**The fade is on the pane, not on the anchor, and has to be.** An ancestor
carrying a composited opacity is a *backdrop root*, and a backdrop root above
the pane leaves its `backdrop-filter` with nothing behind it to blur — the
declaration parses, computes, and does exactly nothing. It fails silently and it
fails only sometimes, because Chromium promotes the layer when the transition
runs and keeps it afterwards: a pane that blurred on first paint stopped
blurring once it had been hovered. So `visibility` stays on the anchor, where it
reaches the padding, and `opacity`/`translate` sit on the pane itself, which is
allowed to be its own backdrop root. Anything that later wants to fade the
popover by fading a wrapper will put the blur out without warning.

The cost of `visibility` is that a hidden popover is now laid out, and a
`loading="lazy"` image inside one would be fetched on page load rather than on
hover. No content passes `showImage` today. If one ever does, the answer is
`content-visibility: hidden` transitioned alongside — it skips the contents
without unrendering the box, so the fade survives it.

`@media print` still hides the anchor with `display: none`, and has to: the
print tests read what a sheet would show through `checkVisibility()`, which by
default ignores `visibility` entirely.

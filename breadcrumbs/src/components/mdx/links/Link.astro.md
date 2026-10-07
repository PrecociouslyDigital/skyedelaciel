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

## 2026-10-03 — the page-preview popover: phrasing only, one image, geometry inline

**Everything in the popover is phrasing content.** A `<Link>` sits inside a
`<p>`, and the HTML parser closes a paragraph at the first `<div>`, `<table>`,
`<dl>` or `<ul>`. Whatever followed would then spill out after the sentence.
So the ledger is spans with `role="table"`, `row`, `rowheader` and `cell`, laid
out with a grid and `subgrid` rather than with table display. Rows stay boxes
(not `display: contents`), because Chromium has a history of dropping roles
from `display: contents` elements. `tests/unit/components.test.ts` checks every
element in a rendered popover against a phrasing allowlist, including popovers
built from hostile summaries and field values.

**One `<img>`, placed by grid areas.** The plan put the image first for a
banner and last for a column. Astro can't hold markup in a frontmatter
variable, so that would have meant writing the `<img>` twice. It is decorative
(`alt=""`), so its DOM order means nothing to a reader. `data-image` on the
pane picks the `grid-template-areas`, and the one element lands in either
place.

**The geometry reaches CSS as an inline style on the pane, not
`define:vars`.** `define:vars` stamps the custom properties onto *every
element* of the component, not just the root: the wrapper, the anchor, the
mark, the cite and every span in the popover, once per link on the page.
`geometryStyle` in `geometry.ts` holds the same numbers `placeImage` decides
with, applied as one `style` on the pane.

**`content-visibility: hidden` answers the lazy-image note above.** It is
transitioned with `opacity` and `translate` through `motion.snap`, plus
`transition-behavior: allow-discrete`. Like `visibility`, it stays visible for
the whole of any transition with a visible end, so the contents appear as the
fade begins and vanish as it ends. `tests/design/links.spec.ts` checks that no
popover image is requested at page load and that one is on hover. Removing the
declaration was confirmed to fail that test.

Its side effect is size containment. A hidden pane lays out as if empty, so it
has no height until it opens. The anchor grows upward from `bottom: 100%`, so
nothing measures the closed pane.

**The pane no longer scrolls; its text does.** The pane is a grid with a
`max-height`, and the text sits in a `minmax(0, 1fr)` row. Per the grid spec, a
flexible track under a definite max size is resolved against that max, so the
row shrinks to the cap and the text inside scrolls. A column image contributes
its natural height at column width, so a short summary beside a tall portrait
still shows the portrait at its own proportions.

## 2026-10-03 — whole column images, and a banner that gives way on scroll

Two review notes: column images shouldn't be cropped, and banners crowded the
text. A middle version had the banner scroll away inside the text. That was
dropped for this: only the text scrolls, the banner pane is taller
(`BANNERED_MAX_HEIGHT`), and the banner shrinks to a strip as the text scrolls.

**The column image is sized by its attributes, not by stretching.** It is
`width: calc(100% - gap)` with `height: auto`, so its height comes from the
`aspect-ratio` the `width`/`height` attributes map to. The pane is the right
size before the lazy image arrives. Leaving `width: auto` would have given an
unloaded image no size at all, and the pane would jump when it loaded. A
portrait too tall for the cap is held by `max-height` and drawn whole inside
its box by `object-fit: contain`, pinned to the right edge.

**The banner runs on a named scroll timeline.** The text declares
`scroll-timeline: --link-popover-text`, and the pane declares `timeline-scope`
for it, because a named timeline is otherwise visible only to the scroller's
descendants, and the banner is the scroller's sibling. The keyframes animate
`height`, not `scale`: the point is to give the text the room, and a transform
would leave the text's box where it was.

Animating a scroller's sibling's height changes the scroller's own size, which
looks like a feedback loop. It isn't, because `animation-range` is in lengths
(`0` to `banner − min`), not percentages of the scroll range. Each pixel
scrolled shrinks the banner by a pixel, the text box grows by that pixel, and
the content stays put on screen while the banner closes over it: a collapsing
header. If the overflow is less than twice the range, scrolling stops partway,
with the banner partly closed and all the text in view.

It is not a transition, so `motion.snap` doesn't apply and `motion.spec.ts`
doesn't see it; the Motion section of the spec now says so. It sits behind
`prefers-reduced-motion: no-preference`, because motion set off by scrolling is
what that preference asks to be spared. Browsers without scroll-driven
animations show a banner that holds still, which is the reduced-motion
behaviour anyway.

**That last sentence was false until the `@supports` was added.** A browser
that doesn't know `animation-timeline` still knows the `animation` shorthand:
it plays the keyframes as an ordinary animation, `duration` defaults to 0, and
`fill-mode: both` holds the end state. Firefox showed every banner already
collapsed to its strip before anything scrolled. The declarations now sit in
`@supports (animation-timeline: scroll())`. The design suite runs Chromium only,
so it couldn't see this. It was found by screenshotting in Playwright's
Firefox. Headless Firefox also draws no `backdrop-filter` at all, even on a
bare test page, so a pane with no blur in a Firefox screenshot is the test
browser, not the site.

## 2026-10-06 — the image sits in a frame

`.link-popover-figure` exists because the image needs two animations at once:
the resolve's blur (on every child of the pane) and the banner's
scroll-timeline `height`. One element can't take both without the hover rule
overriding the banner's `animation`. The frame owns the grid placement and the
glass-gap margins; the img keeps its size and the give-way. When screenshotting
the resolve with paused animations, wait a frame after setting `currentTime`,
and force `:hover` over CDP; otherwise captures lag a stage or lose the hover.

## 2026-10-06 — kept on screen by anchor positioning

At 420px the pane (26rem = 416px) hung off either edge for any link not
centred on the screen. Now `position: fixed` + `position-area: top`, with
`anchor-scope` on the wrapper so each pane finds its own link. Chromium
pushes an overflowing area-placed box back inside its containing block (the
viewport, once fixed), and `margin-inline` keeps a 1rem gutter. Verified at
360/420px, and the suite now measures every popover's box. Without
anchor positioning the old absolute centring is the fallback. Width is
capped at `100vw - 2rem`.

The text parts gained inner spans, and the ledger a `rowgroup`, so each part
has a frame for the resolve blocks separate from the blurred picture (see
_resolve.scss.md). The banner's scroll give-way moved from the img to its
frame, since the img now plays the resolve animation.

## 2026-10-06 — only the image is skipped while the popover is down

`content-visibility: hidden` used to be on the whole pane, revealed after the
standoff. Skipped contents have no style, so in Chrome the parts' resolve
animations were often created only on reveal, and then waited out their own
300ms standoff. Measured on a real build: glass begins 350ms after hover,
blocks 667ms. The user saw it as the glass sitting empty before the quilt
began, and it is probably what read as "mistimed" originally.

Whether skipped content gets styled early depends on Chrome internals. The
Playwright harness's `emulateMedia` forces it, which hid the bug from a timing
test. So `content-visibility` is now on `.link-popover-picture`, a holder
around the img alone, which has no animation. It still keeps lazy images from
being fetched with the page. motion.spec checks the arrangement (nothing that
resolves sits in skipped content), not the clock. That check fails 4/4 on the
old arrangement.

## 2026-10-06 — props are an anchor's

`Props` was `{ href: string; [key: string]: any }`. It is now
`HTMLAttributes<"a">` with a required `href`, since everything else MDX passes
is spread onto the `<a>`.

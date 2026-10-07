# Navbar.astro

## 2026-09-17 — the logo is a CSS mask, not an `<img>`

The logo was `<img src="/logo.svg">`, and the served SVG is black geometry. On
the dark scheme that is a black mark on a near-black page: invisible, and it
had been invisible for as long as the dark scheme has existed.

The anchor now holds an empty `<span>` whose background is
`var(--color-accent)` and whose `mask` is the logo file. The mark takes the
scheme's colour, the way every other ornament on the page does, and nothing in
the artwork has to know there are two schemes.

Masking is also why the mark had to stop being strokes: a mask needs a shape,
and `stroke` is not one. That is part of why `tools/logo.mjs` exists — see
`breadcrumbs/tools/logo.mjs.md`.

The surrounding box — 2.75rem square, a 2px accent border, a small radius — is
the 朱文 seal: the mark in vermilion line inside a vermilion border, the way a
name seal is cut. It is the one place on the site where the accent appears as a
shape rather than as a mark on something else.

## 2026-10-03 — the logo is inlined, so it can be rewritten

The mark is now `src/assets/logo-reduced-brush.svg`, imported as an Astro SVG
component and set into the page, replacing the CSS mask over `/logo.svg`. It is
a verbatim copy of `~/data/logo-reduced-brush.svg`, written by
`~/data/logo-brush.py`, which lives outside the repo; to change it, rerun that
and copy the output over rather than editing the asset by hand.

A mask can only recolour an image. Inlining lets CSS reach the strokes: each is
revealed by a `<mask>` whose centreline path carries `class="logo-ink"`,
`pathLength="1"` and a `--i` giving its place in the stroke order, so a dash
animation on those paths lifts and lays the strokes. Only the outer
`<g fill>` is recoloured; the masks' own black and white must not be.

The rewrite plays once per pointer entry and is allowed to finish after the
pointer leaves, which needs the small script; with CSS `:hover` alone it
snapped back mid-stroke. Its offsets run 0 → -4 in one direction on a `1 3`
dash, which lifts and relays without the jump a reset to +1 would need.

The seal is now `--color-text` rather than `--color-accent`, by request, which
also matches the scheme toggle beside it.

A small speck stays visible near the bottom of the seal while the strokes are
lifted; not yet traced. `public/logo.svg` is no longer referenced by anything,
though `tools/logo.mjs` still writes it and the drift test still checks it.

## 2026-10-04 — one link list, and a current entry

The entries live in `src/components/nav.ts`, shared with the Tumblr theme. An
entry is a site path or a full address; on Tumblr (`host="tumblr"`) site paths
are resolved against `site` in astro.config.mts. The current entry is set in
`--color-text`, not a chroma: accent, signal and attention each already mean a
hand, and "you are here" is none of them.

## 2026-10-05 — three links, one band on narrow screens

Fiction, Nonfiction, Tumblr; About, Writing and GitHub went. Links are 1.1rem.
On narrow screens the seal, links and toggle share one unboxed band (a tab
strip and a 2×2 grid were tried in the prototype and rejected as boxy). Links
are at least 44px tall and wrap two over one when three don't fit; a rule for
five (three over two, keyed on `data-count`) is in place for later. Below
~430px the seal, type and spacing shrink with `cqi` of the sidebar
(prelude.scss makes it the container) rather than wrapping again. The site's
self-hosted Source Serif sets ~3% wider than the prototype's Google copy, so
the spacing was tightened until three links fit on one line at 375px. The
toggle's 44px hit area is clipped by `overflow-x: clip` on the band, so it
can't widen the page at the screen's edge.

## 2026-10-06 — the seal loses its box

The border came off, and the mark now fills what the box took up (4rem, or
15cqi on narrow screens), so the narrow band keeps its height. In the sidebar
the mark is 4.5rem, the links are 1.3rem and the toggle is 1.5rem. 5.5rem was
tried and looked like twice the old mark.

## 2026-10-06 — leaving the logo retraces the rewrite

The script is gone: the rewrite is a `:hover` transition on
`stroke-dashoffset`, 0 → -2 over a `1 1` dash, and a transition interrupted by
leaving turns back from its current value. That needed dropping the wait
between lift and lay (the old `1 3` dash and its hold could only be keyframed),
which the user accepted. Lift and lay now share one `$brush` curve rather than
one each, so the lift is quick and the lay settles.

The stagger delay is set only in the `:hover` rule. Transitions take their
timing from the style being moved to, so arriving waits for `--i` and leaving
does not; with the delay on the base rule, each stroke would wait its turn
again before turning back.

Leaving after the rewrite has finished unwrites the whole thing, since -2 is a
held state. The stroke duration is now `motion.$grow-limit` (600ms) through
`motion.grow`; the old keyframed one ran 1.6s, outside the spec's limit.

## 2026-10-06 — no `data-count`

The five-link grid layout keyed on `data-count="5"` was dead with three links,
and nothing else read the attribute, so both went.

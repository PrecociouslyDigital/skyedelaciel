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

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

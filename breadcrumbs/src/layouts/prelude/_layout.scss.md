# _layout.scss

## 2026-10-06 — the page's measures

`80ch`, `14rem`, `2.75rem` and the `2rem` grid gutter were literals in
prelude.scss, Navbar, Sidenote, ThemeToggle and the Tumblr theme. The wide
grid's `8rem` is four gutters (the body's padding and a column gap, either
side), its `16rem` a column of notes and its gap, and the sticky sidebar's
`100dvh - 4rem` the gutter above and below. The built CSS is byte-identical.

## 2026-10-07 — the measure is in rem, not ch

`80ch` on `<body>` was measured in whichever face had loaded. Georgia's figures
are 0.614em to Source Serif 4's 0.5145em, so until the face arrived the grid
was laid out ~135px wider at 1600px, and the whole page (sidebar, article,
sidenote gutter) jumped when it swapped in. Filmed with a throttled cold load:
CLS 0.03 before, 0.011 after, the remainder being text reflow inside the
column.

`$measure` is now `80 × typography.$figure-advance × typography.$body-size`.
The 0.5145 was read out of the browser (80 zeros in `body.font`, after
`document.fonts.ready`); it is at the body's optical size, since Source Serif
4 has an `opsz` axis. The Navbar and Tumblr feed, which also use `$measure`,
had been measuring `ch` in their own fonts; now all three agree.

Gotcha found on the way: `astro dev` kept serving the old `80ch` in the
server-rendered `<style>` after the partial changed, while the client copy
updated, so a cold load still jumped. Only a dev-server restart cleared it.

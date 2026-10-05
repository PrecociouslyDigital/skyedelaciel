# vines.ts

## 2026-10-05 — vines are drawn by a Sass function, served as files

The vine generator is several hundred lines of geometry: a hand-steered stem,
scrolls, room checks and filters. Porting it to Sass so it could run at
compile time, like `noise()`, would gain nothing. So this integration registers
it with Sass as a host function, `vine(...)`, through Vite's
`css.preprocessorOptions.scss.functions`. Colours still come from colors.scss
at compile time, and nothing runs in the reader's browser.

The function writes the SVG to `.astro/vines/<content hash>.svg` and returns
`url(/.astro/vines/…)`. Vite resolves a root-relative URL to the file in the
project root, so in a build it fingerprints the file into `_astro/` like any
asset, and in dev it serves it directly; both were checked by hand. The URL is
unquoted on purpose: tumblr-theme.ts only absolutises `url(/`, and its hazard
check only catches that form too.

`vine-image` in _ornaments.scss fails the build if the function is missing.
Otherwise Sass would pass an unknown `vine(...)` through as a plain CSS
function, which renders as nothing.

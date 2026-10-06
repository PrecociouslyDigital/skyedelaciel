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

## 2026-10-05 — one host function per question, kinds by name

The table of contents added four more kinds of drawing (section vine, hanging
shoot, shoot, blossom), so `vine($ratio, $seed, …)` became `vine($kind,
$args)`, with `$args` a map: each kind takes what it needs and ignores the
rest, so a whole `$vines` entry plus the scheme's inks is passed as it is.
`vine-box($kind, $args)` answers where a placed drawing lies about its point,
as a positional list (`x y w h frames`) in vine widths. A list rather than a
map, because building a `SassMap` from JS needs `immutable`, which is only a
transitive dependency. Drawings are memoised per argument set: each scheme is
applied twice (system preference and override), and the boxes are asked for
with no inks at all.

Vite inlines assets under `assetsInlineLimit` (4 KB) as data URLs. That put
the blossoms and the shortest section vine inline in every theme block and
doubled the stylesheet, so the integration sets the limit to `false` for its
own directory only; everything else keeps Vite's default.

`blocks()` is Resolve's mask. It has no colour, so it is inline, written as
one path per strength with only `%#<>` escaped (~6 KB for all three).

## 2026-10-06 — `drawing()`, and the files moved to drawn.ts

The Sass function `vine($kind, $args)` is now `drawing($kind, $args)`,
because brush strokes are drawn through it too and are not vines.
`vine-box` keeps its name: `drawing-box` is already the Sass-side wrapper in
_ornaments.scss, and the two would collide.

Writing a drawing to disk moved to `store(root, svg)` in drawn.ts, because
the figure plugin writes plates the same way and imports them with `?url`.
The directory is now `.astro/drawings/`. `store` returns the root-relative
path, so Sass wraps it in `url()` and the MDX import uses it as it is. The
`assetsInlineLimit` exemption reads the same directory through
`drawingsDir`.

# remark-figures.ts

## 2026-10-06 — how a figure is written into the page

- The image and its plate are passed as ESM imports (`import __figure0 from
  "./images/x.jpg"`, `import __plate0 from "/.astro/drawings/…svg?url"`), not
  as a markdown image left for Astro to optimise. Figure.astro then gets a
  typed `ImageMetadata` and renders `<Image>` at the drawn width. The import
  path is the author's relative path, so Vite resolves it from the MDX
  module.
- Plates go through drawn.ts `store`, the same as the stylesheet's drawings,
  and are imported with `?url`, so Vite fingerprints them into
  `dist/_astro/`. figures.spec's "every plate is served" guards that.
- The image's size comes from Astro's `imageMetadata`, which swaps width and
  height for EXIF orientations 5–8. That is the size Astro's own `<Image>`
  reports, so the plate and the picture agree.
- Captions and credits go to the component as `<span slot="…">` flow
  elements holding phrasing (mdx-nodes `inline`). A paragraph would put a `<p>`
  inside the figcaption, and Astro takes `slot` only from a direct child.
- Components are found through `mdxComponents` (Figure, TableFigure), as
  Sidenote is, so the plugin imports none.
- Every check calls `file.fail` at the offending node, so the build error
  points to the line.
- `mdast-util-to-string` is only a transitive dependency, so the file keeps
  its own six-line `toString`. Type-only imports from transitive packages
  (`vfile`, `mdast-util-mdx-jsx`, `estree`) follow remark-sidenotes'
  precedent.

`drawnSize` clamps the height after rounding. Rounding the width of a very
tall sliver up by half a pixel could push its height past 720, and the
property test in figures.test.ts found exactly that.

## 2026-10-06 — listings

Every fenced block becomes `<Listing>`. The fence's meta may be exactly
`title="…"` and nothing else; anything more fails, so a typo in an attribute
can't vanish silently. An untitled listing's id is `lst-N`, and
`referenceText` refuses to cite it, because N shifts when a listing is
added above it. The line count is taken from the raw text, which is the
same count Shiki's `.line` spans give (figures.spec checks they agree).
Shiki runs at the rehype stage, after this plugin, and still finds the
`<pre>` inside the JSX element's children.

## 2026-10-06 — one survey, one dispatch

`survey()` used to collect raw nodes, `apparatusOf` turned each into an
`Apparatus` with a switch, and the transform re-checked images and re-parsed
captions (`image.alt!`, `image.title!`, three `marked(...)!`) in an if/continue
chain whose narrowing broke (`kind: "lemma" | "theorem"` left `item` as
`ImageFigure | Statement` after the chain, a tsc error). Now each surveyed
item is its own apparatus: `form` says what was written (image, code, table,
term, statement), `kind` what it is numbered as, `name` what its id is made
from. Validation happens once in `survey()`, and `Marked` keeps a caption's
paragraph with its parsed text. One exhaustive `match` on `form` builds every
replacement; the image arm is the only async one.

`<Lemma>`/`<Theorem>` are recognised by `KINDS[kind].label`, and `Table:` and
`Credit:` are named constants used in both parsing and error messages.

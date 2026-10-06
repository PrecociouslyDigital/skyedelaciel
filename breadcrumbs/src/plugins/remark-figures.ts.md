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

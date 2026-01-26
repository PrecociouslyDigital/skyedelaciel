Custom plugins in `astro.config.mts`:

## `defaultLayout`
Automatically applies `@/layouts/md.prelude.astro` to all markdown files, eliminating the need for explicit layout frontmatter.

## `extractLinks`
Extracts all links (both inline and reference-style) from markdown content and exposes them via `frontmatter.links`. Useful for link validation or building a link graph.
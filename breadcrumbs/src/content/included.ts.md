# included.ts

## 2026-10-06 — one INCLUDE_FIXTURES, one FIXTURES_DIR

`process.env.INCLUDE_FIXTURES` was read in corpus.ts, links/cache.ts and
tumblr-theme.ts, and the `fixtures` directory was spelt out in
content.config.ts, internal-links.ts, cache.ts, tumblr-theme.ts and the sample
blog. Both are here. The plan was to export them from corpus.ts, but corpus.ts
imports `astro:content`, which the integrations and content.config.ts cannot
load, so they got a plain module of their own.

corpus.ts's old comment said the variable is read at call time because a
route's `getStaticPaths` is hoisted. That hoisting only cuts
`getStaticPaths` off from consts declared in the component's own
frontmatter; a const imported from a module is still in scope, so reading it
once at import is fine.

The sample blog (content/fixtures/tumblr.ts) exports `BLOG`/`PERMALINK` and
keys its pages by them, so tumblr-theme.ts writes each page at its own path
and tools/browser/profiles.mjs takes the suite's Tumblr pages from them. That
file imports relatively, with extensions, so plain Node (the browse daemon)
can load it.

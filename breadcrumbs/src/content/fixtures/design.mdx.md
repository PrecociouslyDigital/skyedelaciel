Moved here from src/content/design.mdx so that the spec is a test surface
rather than a published page: a plain `astro build` no longer routes it, and it
lives at /fixtures/design/ only when INCLUDE_FIXTURES is set. At the
time of the move it was the only article in the `pages` collection, so a plain
build has no articles and warns that `pages` is empty.

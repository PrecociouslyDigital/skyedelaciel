2026-10-07: A published copy of src/content/fixtures/kitchen-sink.mdx, not the fixture
moved. Moving it broke the build: the fixture links to /not-a-page and
/fixtures/design on purpose, and internal-links refuses dead links on real
pages, while the test suite needs both. So this copy drops the Unresolved
section, points Internal Link at /nonfiction/, and takes its figures from
src/assets/link-images/ (the originals of fixtures/images/). Edits meant for
both pages have to be made twice.

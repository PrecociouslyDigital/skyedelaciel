# figures.spec.ts

## 2026-10-06

"Prose images" excludes `.link-popover img`. The popovers carry pictures of
where a link leads, which are not the page's own.

Clicks go through `copyLink()` in _harness.ts, which waits for the island to
hydrate. Before hydration a copy link is a plain link, and on /design/ a
click could land first, follow the link, and leave no receipt.

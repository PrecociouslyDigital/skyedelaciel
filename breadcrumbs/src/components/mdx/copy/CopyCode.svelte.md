# CopyCode.svelte

## 2026-10-06 — `client:idle`, not `client:visible`

It renders nothing on the server, because without a script a Copy button
could do nothing. An island with no children gives `client:visible`'s
IntersectionObserver nothing to observe, so it never hydrated. The
figures spec caught it.

It copies `pre code`'s `textContent`. The line numbers are `::before`
content, so they never reach the clipboard.

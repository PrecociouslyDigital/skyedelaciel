# CopyLink.svelte

## 2026-10-06 — one component for every copyable address

Headings use it now, and figures, tables and listings will use it next. Its
markup without JS is a plain `<a href>`. The receipt word and the live region
only render after mount (`mounted`), so the nojs page has no orphan COPIED
span.

How long `leaving` lasts is read from the word's own animations
(`getAnimations()` and then `finished`), so the duration lives only in
receipt.scss. Under reduced motion there are no animations, the promise
resolves at once, and the receipt goes straight to idle. receipt.scss also
hides the word in `leaving` under reduced motion, so it can't flash for a
frame.

Modified clicks (ctrl/meta/shift/alt, or any button but the primary) are
left to the browser, so "open in new tab" still works. The address goes into
the bar with `replaceState`, not `location.hash`, so the page doesn't jump.
If the clipboard refuses, it falls back to `location.hash`, which does what a
plain link would.

Replaces heading/CopyAnchorIcon.svelte (deleted).

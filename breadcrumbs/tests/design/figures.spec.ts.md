# figures.spec.ts

## 2026-10-06

"Prose images" excludes `.link-popover img`. The popovers carry pictures of
where a link leads, which are not the page's own.

Clicks go through `copyLink()` in _harness.ts, which waits for the island to
hydrate. Before hydration a copy link is a plain link, and on /design/ a
click could land first, follow the link, and leave no receipt.

## 2026-10-06 — listings

The clipboard comparison normalises `\r\n`, because on Windows the system
clipboard hands back CRLF for what was written with LF. The Copy control
wrote exactly the code; the OS changed the line endings.

## 2026-10-06 — table labels are not 1..n any more

"a table's caption stands above it" expected `Table ${i + 1}`, from before
tables were numbered within their top-level section ("Table 3.3"). It now
checks only the label's shape; Numbering checks which number each carries.

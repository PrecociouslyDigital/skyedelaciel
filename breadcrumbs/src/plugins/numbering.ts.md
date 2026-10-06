# numbering.ts

## 2026-10-06 — section numbers

`sectionNumbers` counts from the shallowest depth on the page, so a page
written from `##` down numbers its sections 1, 2, 3, and not 0.1. The first
heading must be at that top depth, or it has skipped a level. `SkippedLevel`
carries the heading's index so that remark-sections can `file.fail` at the
right node, with its position, instead of throwing a bare error.

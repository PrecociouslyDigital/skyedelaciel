# numbering.ts

## 2026-10-06 — section numbers

`sectionNumbers` counts from the shallowest depth on the page, so a page
written from `##` down numbers its sections 1, 2, 3, and not 0.1. The first
heading must be at that top depth, or it has skipped a level. `SkippedLevel`
carries the heading's index so that remark-sections can `file.fail` at the
right node, with its position, instead of throwing a bare error.

## 2026-10-06 — apparatus

`KINDS` is an exhaustive `Record<Kind, …>`, so adding a kind (listings, in
Phase 5) makes the compiler ask for its prefix and labels. Numbers run per
kind from 1 and are not tied to sections ("Figure 2", not "Figure 3.2"),
which keeps an id stable when sections move. Ids come from slugs (a
figure's file name, a table's caption), so a duplicate is a naming
collision the author can fix. It fails the build, naming the id.

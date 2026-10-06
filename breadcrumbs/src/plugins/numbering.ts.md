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

## 2026-10-06 — listings fold into figures; definitions join

Asked for directly: code blocks are figures ("Fig. n", `#fig-…`), numbered in
the same sequence as images; the `listing` kind and `lst-` prefix are gone.
`Apparatus` now lets only a figure lack a name, which is looser than before
(an image always has one) but the plugin gives images a name unconditionally.
An untitled code figure's id is `fig-<n>`, so it can collide with an image
named `<n>`; DuplicateId catches that.

Definitions are a third kind: `def-`, "Definition", "Def.". remark-figures
picks up `<dt>` JSX elements (definition lists are only written as raw JSX in
MDX) and swaps each for `Term.astro`, which closes the term with its address
the way a heading does rather than captioning it.

## 2026-10-06 — two tracks, numbered within top-level sections

Asked for directly, reversing the "not tied to sections" choice in the first
entry: figures (images, code, tables) and statements (definitions, lemmas,
theorems) are two tracks, each counted from 1 within each top-level section
("Fig. 3.2", "Theorem 3.4"). Tables joined the figures' track so that no
number names a figure and a table at once. Items before the first heading are
numbered plainly ("Fig. 1"); LaTeX's "0.1" was the alternative. Ids are still
slugs of names, so they stay stable; only unnamed things (code without a
title, lemmas and theorems without a name) take their number as id and stay
uncitable.

remark-figures reads the top-level number off each heading's `data-section`,
which remark-sections writes, and fails the build if it is missing rather than
numbering flat. Terms are matched as both flow and text JSX elements: a
`<dl>` written on one line parses as text and was silently skipped before.

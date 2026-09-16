# tests/unit/components.test.ts

## 2026-09-16 — read the rendered markup back as data

The table-of-contents tests matched rendered HTML as strings —
`toContain('<a href="#one">One</a>')`, `html.match(/<details/g)` counted to 2,
`html.indexOf("#one-a") < html.indexOf("#two")`. All three break on a changed
attribute order or a reflowed line, none of which is a change to the table of
contents, and the count of 2 says nothing about *which* headings became
collapsible.

`entriesIn` and `parentsIn` extract the slugs, the link text and the collapsible
sections in document order. `<details>` already carries `data-slug`, so the set
of parents can be read off the output directly and compared with what the input
implies — which turns "is `<details>` there twice?" into "is a heading
collapsible exactly when it has children?", quantified over several heading
lists rather than one.

`expectedParents` restates the rule (a heading owns the following headings that
are deeper, up to the next one at its own level or above) rather than calling
`buildTree`; a test that imported the implementation would agree with it by
construction.

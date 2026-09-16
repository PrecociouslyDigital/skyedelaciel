# CopyAnchorIcon.svelte

## 2026-09-16 — `all: unset` outranks any rule written outside this file

The print rule lived in Heading.astro as `@media print { :global(.copy-anchor)
{ display: none } }`, and had no effect: Svelte scopes this component's rules
with its own class, so `.copy-anchor.svelte-xxx { all: unset }` carries two
class-level selectors to the global rule's one. `all` sets `display` to its
initial value, and the higher specificity means it wins — silently, since
nothing about the markup or the cascade order hints at it.

Moving the print rule here puts it behind the same scoping class, so it wins on
source order instead, and puts it next to the declaration that would otherwise
undo it. Any future rule targeting this button from outside has the same
problem; the fix is to write it here.

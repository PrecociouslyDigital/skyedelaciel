# rehype-task-lists.ts

## 2026-10-06 — why a plugin

Phase 2 added a task list to the kitchen sink, and axe flagged GFM's bare
checkboxes as critical (`label`). The fix belongs where the markup is made,
so every page's task lists are fixed and no author has to remember. The
plugin uses `aria-label` rather than wrapping the words in `<label>`,
because a loose task holds `<p>`s, which a label cannot contain. It is
registered in `markdown.rehypePlugins`, which MDX extends, so `.md` pages get
it too.

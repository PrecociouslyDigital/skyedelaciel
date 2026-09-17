# astro.config.mts

## 2026-09-17 — syntax highlighting is off, and code blocks got a tabindex

Astro highlights fenced code with Shiki by default, themed `github-dark`. Shiki
writes its colours and its background **inline on the elements**, so no
stylesheet can re-ink them for the reader's scheme: a light page would have
carried a dark grey slab, and the palette's one-accent rule would have been
broken by every code block on the site. `syntaxHighlight: false` gives plain
`<pre><code>`, which the stylesheet then sets in ink on the raised surface like
everything else.

`rehype-code-blocks.ts` puts `tabindex="0"` on every `<pre>`. A code block that
scrolls sideways is a scrollable region, and axe reports a scrollable region
with no keyboard access as a serious violation — correctly, since without it
the overflow is reachable only with a pointer. Markdown offers no way to write
an attribute onto a fence, so it is added in a plugin rather than asked for at
each call site. It showed up the moment `kitchen-sink.mdx` gained a code block
narrow enough to overflow the 420px profile.

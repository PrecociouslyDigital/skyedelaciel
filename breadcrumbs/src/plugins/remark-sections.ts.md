# remark-sections.ts

## 2026-10-06 — MDX only, and never in the text

The plugin is registered on `mdx()` only, beside remark-sidenotes, which
moved there in the same change. Both serve MDX components (Heading.astro,
Sidenote), and resume.md, a plain .md page, renders neither. As far as
was established during planning, `mdx({ remarkPlugins })` replaces the
Markdown list instead of extending it, so astro.config.mts restates the
shared plugins.

The number goes on `data-section` through `hProperties`. It never goes into
the heading's text, so slugs, the table of contents and the `headings` Astro
hands to the layout are unchanged.

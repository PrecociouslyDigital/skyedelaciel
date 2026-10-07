# theme.ts

## 2026-10-06 — the storage key and the toggle's id

`"theme-override"` and `"theme-toggle"` were each written in Shell.astro's
pre-paint script and ThemeToggle.astro. The pre-paint script is `is:inline`
(it must run before paint, unbundled), so it takes `THEME_KEY` through
`define:vars`, which wraps it in an IIFE in the built page.

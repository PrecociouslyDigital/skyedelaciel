# `src/layouts/prelude/Shell.astro`

## 2026-10-07 — the four Latin font files are preloaded

Fontsource declares `font-display: swap`, and its files are only discovered
once the stylesheet is applied, so the first frame painted in Georgia. The four
Latin files (the ones the Tumblr breadcrumb counts) are now `<link
rel="preload">`ed via Vite `?url` imports, which resolve to the same hashed
asset the stylesheet names. Measured on a cold load at 400KB/s and 1.5MB/s:
Source Serif (both styles) and Cormorant are loaded by the first frame.

On Tumblr the hrefs are made absolute by `absolute()` in tumblr-theme.ts, and
`crossorigin` matches the CORS grant in `public/_headers`. Not yet checked
against a production build.

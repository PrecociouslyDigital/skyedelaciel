# site.ts

## 2026-10-06 — the site's identity in one place

`SITE_NAME`, `SITE_HOST` and `SITE_DESCRIPTION` lived in links/sources.ts,
and the name was restated as the default author in Shell.astro and md.astro,
as the sample blog's title, and as the host in astro.config.mts. They are
here now, with `AUTHOR` (the site is named for its author, so `SITE_NAME` is
`AUTHOR`), `SITE_URL`, and `onSite(path)`, the one `new URL(path, SITE_URL)`.
`pageHref(id)`, the inverse of `internalId`, sits beside it in resolve.ts and
builds every `/${id}/` link (404, PieceList, rss).

Modules astro.config.mts loads (links/cache, resolve, sources) import this
relatively: the `~` alias is Vite's, and the config is loaded before Vite.

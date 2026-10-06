# `tools/cloudflare/setup.sh`

## 2026-10-05 — one Access application, three destinations

The scheduled prefix is reachable at more than the site's own address. A Pages
project also answers at `<project>.pages.dev` and at a subdomain of that for
every preview deploy. With only the apex protected, `/scheduled/` would be
open under the project's default domain. So the one application covers the
apex's prefix, the project domain's prefix, and every preview host entirely.

One fixed rule rather than one per article. Publishing changes other pages
too (home, listings, the feed, the sitemap), so a rebuild is needed on the
day regardless. A rule per article would add a step that fails open, where
the page is uploaded before its rule exists, and keep state in Cloudflare
that the repo does not record.

The project's pages.dev subdomain is read back from Cloudflare, not assumed,
because a project name that was used before can be given a suffixed one.

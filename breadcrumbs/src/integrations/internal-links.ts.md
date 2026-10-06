# `src/integrations/internal-links.ts`

## 2026-10-05 — written here instead of using astro-broken-links-checker

The package was already a dependency, but it can't be told that some pages
follow different rules. Fixtures link to missing pages on purpose. A
scheduled page links to its scheduled siblings by the paths they will have
once they are out. The package checks external links by default too, which
would make every build depend on the network. The check itself is about
forty lines over `hast-util-select`, so the package was removed.

The date rule ("a scheduled article may not link to one that comes out after
it") is enforced in `PageEntry.astro`, not here, because the built HTML no
longer knows dates. Without it, the daily build that publishes the earlier
article would be the one to fail.

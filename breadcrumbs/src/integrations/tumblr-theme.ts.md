# `src/integrations/tumblr-theme.ts`

## 2026-10-04 — the Tumblr theme is a page of the site, post-processed

The theme is `src/tumblr/Theme.astro`, built on the same `Shell.astro` as every
page, and routed at `/tumblr-theme` only so that `astro dev` shows it. After the
build this integration turns it into what Tumblr takes and removes it from
`dist/`. Writing the theme as a second HTML file was the alternative; it would
have been a second copy of the shell and the stylesheet, which is the drift the
whole arrangement exists to prevent.

- **Inlined, not linked.** Astro's stylesheet names are content hashes, so a
  theme that linked `/_astro/…css` would break on the next deploy that changed
  a style, until someone re-pasted it. Inlined, a deployed theme keeps working
  however stale it is. Fonts are the exception — four Latin files, ~330KB —
  and are fetched from skyedelaciel.com by full URL, which is what
  `public/_headers` grants Tumblr's origin. A fontsource upgrade renames them,
  so it makes the live theme stale; the drift check catches that like any
  other change.
- **The stamp is a hash of the theme, not the git revision.** A commit that
  leaves the theme alone must not make CI demand a re-upload. For the same
  reason the theme's rail has no `rev` segment, unlike the site's.
- **ThemeToggle left Svelte** so that the theme loads no island. An island's
  component and renderer chunks import each other, so they cannot be inlined,
  and fetched from the site they would need CORS on module scripts too. The
  toggle used no Svelte reactivity, only DOM calls in `$effect.pre`.
- **Hazards fail the build**, each found once: a root-relative URL (it would
  resolve against Tumblr), an island, an unbalanced block (`parse` throws),
  and a `{Word}` inside a script or stylesheet. Tumblr substitutes its
  variables everywhere in the file, minified code included.
- **Fixtures.** Under `INCLUDE_FIXTURES` the inlined theme, before its URLs are
  made absolute, is filled in by `src/tumblr/render.ts` with the sample blog in
  `src/content/fixtures/tumblr.ts` and written to `/fixtures/tumblr/`. The
  fixture data is imported statically: by `astro:build:done` the config's Vite
  module runner has closed, and a dynamic import there throws.

A fixture build and a plain build produce byte-identical themes (checked:
same stamp), so CI's plain build and a local upload agree.

## 2026-10-07 — no http:// at all

Tumblr's save rejected the theme ("references assets from non-HTTPS URLs")
over 31 copies of `http://www.w3.org/2000/svg`, all in CSS SVG data URIs that
are never fetched. A standalone SVG needs the namespace, so it stays, with its
colon percent-escaped (`http%3A//`), which the data URI decodes back. All 24
distinct URIs were checked to still load as images in Chromium. The HAZARDS
entry makes any other `http://` fail the build instead of the save.

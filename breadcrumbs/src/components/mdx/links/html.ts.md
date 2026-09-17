# html.ts

## 2026-09-16 — remote markup is parsed, not pattern-matched

Three places were treating third-party HTML as string: `preview.ts` turned
`<p>` into `<span>` with `replaceAll`, `resolve.ts` pulled a document title
out with `/<title[^>]*>([^<]+)<\/title>/i`, and `cite.ts` still finds the
citation URL with `String.replace` (that one is untouched for now). None of
them sanitised anything, and a Wikipedia extract or an OpenGraph description
went to `set:html` exactly as the source wrote it.

That was survivable while a summary was one line of someone else's prose. It
stops being survivable with full articles, so the parse comes first and the
rest of the pipeline is built on it.

**Sanitising happens at `buildPreview`, not at resolution.** Cleaning before
caching would be cheaper — once per fetch instead of once per render — but it
puts the guarantee in the wrong place. Content reaches the popover from three
directions: a fresh fetch, `.link-cache.json`, and the hand-written
`manual-links.json`. Sanitising at the render chokepoint covers all three with
one rule, including entries that were cached *before* the schema was
tightened, which a clean-on-write scheme would serve unchanged until their TTL
expired. `buildPreview`'s doc comment already claimed to be the single place
that decides popover content; this makes that claim load-bearing.

**`summarySchema` is built from nothing, not by extending `defaultSchema`.**
`hast-util-sanitize`'s default is GitHub's comment schema — it permits
headings, images, tables and `className`, none of which a one-line popover
body has any use for, and its contents would become a silent dependency on an
upstream default. Starting empty means an element is present only because it
was named. `attributes["*"]` is likewise empty: `class` and `id` are never
needed in a summary, and allowing them lets a source collide with the site's
own selectors.

Links in a summary get `rel="nofollow noopener noreferrer"` added and
`target` dropped. A quoted source's outbound links are not the site's
endorsements, and where they open is the reader's business.

**A finding, recorded because it will recur:** `<title>` is a RAWTEXT element,
so `<title>A <em>Good</em> Page</title>` really does contain the literal text
`A <em>Good</em> Page` — the parser is right and the nesting is an illusion.
The old regex stopped at the first `<` and returned `"A "`. The same rule is
the reason JATS cannot be parsed with an HTML parser: `<title>` inside a
`<sec>` puts the tokeniser into RAWTEXT and swallows the rest of the section.
Europe PMC full text will need an XML parser for that reason.

## 2026-09-16 — the test is an allowlist too

The first version of `html.test.ts` asserted safety with a `FORBIDDEN` regex —
`/<script|<iframe|…|\sclass=/` — run over the output. That is a denylist
guarding an allowlist, which is the shape this repo keeps deciding against,
and it had already rotted: of fifteen hostile inputs, two (`target="_blank"`
and `<math><mi>x</mi></math>`) did not match the regex even as *input*, so an
identity `inlineSummary` would have passed them. Nothing asserted that
`target` is dropped, though the note above claims it.

It now walks the output and checks every element against
`summarySchema.tagNames` and every attribute against what the schema permits
for that tag — including the `rel` that `required` adds, which is allowed
without appearing in `attributes.a`. The assertion cannot fall behind the
schema, because it is derived from it. Replacing the sanitiser body with
`return html` fails twenty tests where it used to fail thirteen.

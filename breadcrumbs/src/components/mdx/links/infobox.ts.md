# infobox.ts

## 2026-10-03 — the infobox comes from Parsoid HTML, not Wikidata

Wikidata has many of the facts but not the infobox. Most English infoboxes are
hand-written template parameters, so the labels, the choice of rows and their
order exist only in the rendered article. Wikidata values are also entity IDs
that need a second round of lookups to get readable labels. The summary
endpoint is still used for the lead, because its `extract_html` comes already
cleaned. The page HTML (`rest_v1/page/html`) is fetched only for the table, and
a failure there drops the fields and nothing else.

**Cleaned here, sanitised in `buildPreview`.** Two jobs have to happen before
`hast-util-sanitize`, because they depend on `style` and `class`, which
sanitising removes. The first is removing what the article hides: inline
`display:none`, and the `geo-*` classes that Wikipedia's own TemplateStyles
hide, which would otherwise print every coordinate twice. The second is
resolving Parsoid's `./Title` hrefs against the article's URL, since a
relative link would otherwise point at this site. Sanitising itself stays at
the render chokepoint, per html.ts.md, so that `manual-links.json` fields get
the same treatment as fetched ones.

Only the infobox's direct rows are read (`:scope > tbody > tr`). Infoboxes nest
`table.infobox-subbox`, and Wang Xizhi's transcriptions sub-box alone would
fill the six-row cap.

The fixture is pinned to a revision (`page/html/Wang_Xizhi/1376319871`), and
`.prettierignore` keeps it byte for byte. Prettier reformatted the first copy
into something Wikipedia never served.

# TocEntry.astro

## 2026-10-07 — `index` is required; Tumblr's entries are `counted`

`index` (and so `--i`) used to be optional, because Tumblr fills in its tags
when it serves the page and the theme has no number to give. Leaving it off
fell through to `--i: 0` on every entry, and a section with no `entries`
fell through to `--n: 20` (the long vine's length). So on Tumblr every tag
arrived and resolved at once, at the very start of its section's growth,
instead of as the growing tip reached it.

Now `index` is `number | "counted"`, so an entry can't be written without
saying where its place comes from. `"counted"` sets `data-counted`, and
toc.scss gives such an entry `--i` from `:nth-child`, and gives its section
`--n` and a vine drawn to length from
`:has(> details > .toc-list > li[data-counted]:last-child:nth-child(n))`.
Counting siblings is only right for a flat section. The main site's
third-level entries are numbered across their second-level parents, so they
keep build-time numbers.

tests/design/motion.spec.ts checks the property on both sites: in every
section, entry k of n computes `--i: k` and the section `--n: n`.

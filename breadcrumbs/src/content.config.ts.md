# content.config.ts

## 2026-09-16 — fixtures are a second collection, not a prefix convention

`/design` was the only page, and it does not exercise several sections of the
design spec: `bibliography: true`, the four popover styles, adjacent sidenotes
that have to push each other apart, headings nested deeper than the table of
contents renders. The tests need a page that does.

The obvious approach — a `fixtures/` prefix inside the existing `pages`
collection, filtered out at build time — leaves the fixture one forgotten
`filter` away from shipping. A second collection makes that structurally
impossible instead:

```ts
const pages    = glob({ pattern: ["**/*.mdx", "!fixtures/**"], … });
const fixtures = glob({ pattern: "fixtures/**/*.mdx",          … });
```

The negated glob means a fixture cannot leak into `pages` by being named
carelessly — only by being moved out of the directory entirely. And
`getStaticPaths` in `[...slug].astro` has to name the `fixtures` collection
explicitly to route any of it, which it only does when `INCLUDE_FIXTURES` is
set. A plain `npm run build` emits one page; `npm run build:fixtures` emits two.

Internal-link resolution deliberately reads **both** collections regardless, so a
link to a fixture still resolves to a title and abstract. Only the route is
withheld, not the metadata.

### The gotcha

`getStaticPaths` is hoisted out of the component's frontmatter scope by Astro, so
it cannot close over a module-level `const` declared above it. Reading
`process.env.INCLUDE_FIXTURES` inside the function is not a style choice —
hoisting it out fails the build with `includeFixtures is not defined`.

## 2026-09-16 — the fixture's links are deliberately unreachable URLs

`astro.config.mts` resolves every link at build time, so a fixture full of real
URLs would make the test build depend on the network and on whatever those pages
happen to say today. The fixture's links instead point at reserved or
non-existent addresses — `example.com`, the reserved `10.0000/` DOI prefix, a
Wikipedia article that does not exist — with matching entries in
`manual-links.json`.

That keeps the fixture build hermetic, and keeps its citation metadata from ever
being mistaken for a real work's.

## 2026-09-18 — `published` is required, `updated` is not

The rail slug dates the page rather than naming it, so the dates had to come
from somewhere a build could not shrug off. `published` is required: a page
that forgets it fails the content sync rather than shipping an undated stamp.
`updated` is optional because its absence is meaningful — an unedited page has
no second date, and `md.astro` drops the segment rather than printing a
placeholder.

Both are `z.coerce.date()` rather than a string with a regex, so that an
impossible day is caught by the parser instead of being printed. YAML hands
them over as dates at UTC midnight, which is why `md.astro` reads them back out
in UTC: any local-time formatter would shift half the world's pages by a day.

## 2026-10-05 — scheduled articles are a collection of their own

An article dated in the future is built only under `/scheduled/`, which
Cloudflare Access keeps to the author. The alternative was to filter
`pages` wherever it is read: in the route, the listings, the feed, and the
link popovers. Every one of those would have been a place to forget the
filter. Instead the same glob feeds two collections, `pages` and `scheduled`,
each keeping the entries on its side of today (`src/content/partitioned.ts`).
So no `getCollection("pages")` can see a scheduled page at all.

The partition has to re-judge entries the glob loader did not touch. The
loader skips an entry whose file is unchanged, so without the sweep after
`load`, a page scheduled yesterday would stay in `scheduled` forever.
`tests/unit/schedule.test.ts` runs a fake of that loader through daily builds
to hold this.

Fixtures get the same split (`fixtures`, `scheduledFixtures`,
`fixtureSections`), and `src/content/corpus.ts` is the only place that
decides which collections a route reads.

## 2026-10-05 — the day is Los Angeles's

`published` is a day, not an instant, and "has its day come" needs a
calendar. The author's is Los Angeles. UTC would publish at 4 or 5pm the day
before. The daily build runs at 08:15 UTC because that is past LA midnight
under both PST and PDT, so no DST logic is needed anywhere.

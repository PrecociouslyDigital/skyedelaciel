# cite.ts

## 2026-10-06 — one webpage entry, one today

Four copies of `{ type: "webpage", id: url, URL: url, … }` in resolve.ts and
sources.ts are `webpageEntry(url, fields)`. `todayParts` used the build
machine's local date, while publishing uses `PUBLISHING_ZONE`'s; it now asks
schedule.ts's `today()`, so an `accessed` date and a publication date agree
about what day it is.

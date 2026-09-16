# tsconfig.json

## 2026-09-15 — `noUncheckedIndexedAccess` is load-bearing

Turned on deliberately, along with `noImplicitReturns`. Both were measured
against the tree first: `noImplicitReturns` found nothing, and exists to keep a
`switch` or `match` that forgets a variant from silently widening its return
type to `| undefined`. It is *not* part of `strict`, and Astro's strict preset
does not add it.

`noUncheckedIndexedAccess` found four real sites, including the date bug
described in `breadcrumbs/src/components/mdx/links/resolve.ts.md`: it flagged
`new Date(year, month - 1, day)` because destructuring `parts.map(Number)`
yields `number | undefined`.

If it starts complaining about something new, the honest fixes are to narrow
the type, hold the element in a variable, or match on shape with `ts-pattern`
(which does narrow an array to a tuple, so `p[0]` is safe inside a
`{ "date-parts": [[P._, P._, P._]] }` arm). Turning the flag back off would
re-admit exactly the class of bug it caught.

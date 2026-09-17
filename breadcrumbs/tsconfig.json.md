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

## 2026-09-16 — `@astrojs/ts-plugin` only fixes the language service

`@astrojs/ts-plugin` is registered under `compilerOptions.plugins` so a plain
tsserver — VS Code, `typescript-language-server`, an agent's LSP — can resolve
`import Foo from "./Foo.astro"`. Without it, those imports raise TS2307 in
every editor, while `astro check` reports zero errors on the same tree
because it runs the Astro language server instead.

The plugin resolves real prop types, not an `any` shim — passing an unknown
prop to a `.astro` component is still an error.

`compilerOptions.plugins` only affects the language service: `npx tsc --noEmit`
does not load it, so bare `tsc` still reports TS2307 on the `.astro` imports.
Those errors come from using the wrong tool, not a defect — `npm run check`
(`astro check`) is this repo's typechecker.

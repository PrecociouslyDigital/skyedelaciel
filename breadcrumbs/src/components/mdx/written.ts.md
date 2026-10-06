# written.ts

## 2026-10-06 — one contract for plugin-written components

Remark plugins built `<Figure>`, `<Term>`, `<Sidenote>`… with
`Record<string, Prop>` props, and each component restated its props by hand,
so nothing checked that the two agreed. `Written` is that contract.
`Written<"written">` is what a plugin writes (an imported value as
`Imported`, its identifier); `Written` (`"received"`) is what the component
gets (`ImageMetadata`, a URL string). It is plain TS, not in a component, so
the plugins can import it. `mdx-nodes`' `block`/`inline`/`recast` are generic
over its keys, and components/mdx/index.ts `satisfies` a record over them, so
a written component that is not registered fails tsc.

`<span slot="…">` is not a component, so it got its own builder, `slot`,
instead of loosening `inline`'s types; `inline` now builds a real
`mdxJsxTextElement`, which remark-sidenotes uses.

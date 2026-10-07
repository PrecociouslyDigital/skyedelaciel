# render.ts

## 2026-10-06 — `Scope` is keyed by tags.ts's names

`Scope` was `{ [name: string]: Value }`, so a misspelt key in the sample blog
filled nothing in, silently. It is now keyed by `TumblrVariable` and
`TumblrBlock`: a variable takes a string, a block a boolean or a list, and a
name that is both (`Quote`, `Title`) either. A template name outside both
lists is looked up as nothing, which is what Tumblr does.

# `src/tumblr/Post.astro`

## 2026-10-04 — reblogs walked item by item; unverified against Tumblr

Tumblr's docs say that inside `{block:Reblogs}` `{Body}` is one trail item, and
inside an original post it is the post. They do not say outright what `{Body}`
is for a reblog outside that block; the theme assumes it is the legacy nested
blockquotes of the whole trail, and so renders `{Body}` only under
`{block:NotReblog}` and walks the trail otherwise. Check this against a real
reblog once the theme is live.

`{PostSummary}` and `{PostTitle}` exist only on permalink pages, which is why
the index's contents name a post by its day (and its title, if it is a text
post with one) — see `Contents.astro`.

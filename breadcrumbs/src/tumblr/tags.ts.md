# tags.ts

## 2026-10-06 — the tag grammar and the post id

render.ts's parser and tumblr-theme.ts's "a {Word} inside a script" check
each spelt out Tumblr's name pattern, and Post.astro and Contents.astro each
wrote `post-{PostID}`. `TAG`, `WORD` and `POST_ID` are here, built from one
`NAME`.

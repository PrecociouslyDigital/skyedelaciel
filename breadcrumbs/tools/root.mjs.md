# root.mjs

## 2026-10-06 — one repoRoot

profiles.mjs exported a `repoRoot`, and tools/logo.mjs and logo.test.ts each
computed their own. They import this one. It lives outside tools/browser/ so
that the logo generator does not depend on the browser tooling. The tools
also import `@playwright/test`, the declared dependency, instead of
`playwright`, which was only there as its dependency.

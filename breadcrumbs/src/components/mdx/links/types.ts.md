# types.ts

## 2026-09-15 — where the CSL schema came from, and why `cslName` exists

`cslData`, `cslDate` and `cslCitation` are a transcription of the official
CSL-JSON schema (`resource.citationstyles.org/schema/latest/input/json/`). It
validates far more than this site renders — about ten fields ever reach a
template — but it is what makes an arbitrary CrossRef response safe to trust,
so it is deliberately not trimmed.

The transcription inlined the same name object 26 times, once per contributor
field (`author`, `chair`, `collection-editor`, … `translator`) — 550 of the
file's 846 lines. That is now `cslName`, and each field is
`cslName.array().optional()`. If the schema is ever re-transcribed from source,
re-extract it rather than taking the generated inline copies.

The site's own link model (`LinkKind`, `Summary`, `LinkEntry`, `LinkMeta`) sits
at the *bottom* of the file, below `cslData`. That is a runtime constraint, not
a style choice: these are `const` schemas that reference `cslData`, so they
cannot be declared above it.

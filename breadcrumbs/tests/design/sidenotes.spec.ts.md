# tests/design/sidenotes.spec.ts

## 2026-09-16 — the float layout has an exact property, so assert that

"Aligned with their footnote marker as much as possible" was being checked as
`offset > -24 && offset < 600`. The 600 was arbitrary: a note could drift half a
page from its marker and still pass.

`Sidenote.astro` lays the notes out with `float: right; clear: right`, which
means each note's top is exactly `max(its own marker's top, the previous note's
bottom)` — level with its marker unless the note before it is still in the way.
That is the whole claim, so the test asserts it, with a tolerance of one line
height (a marker is a superscript, so its box sits inside the line rather than
at the top of it) rather than a made-up pixel count.

The tolerance binds: collisions in the fixture push notes down by far more than
one line.

## 2026-09-16 — one toggle body, two profiles

The narrow and nojs tests were near-copies of each other, and the nojs one
hardcoded `{ width: 420, height: 900 }` — a second copy of `profiles.narrow`.
Both now call `togglesInline`, and the nojs test borrows the width from the
profile table.

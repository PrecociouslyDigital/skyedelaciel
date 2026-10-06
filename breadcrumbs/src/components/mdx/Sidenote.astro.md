# Sidenote.astro

## 2026-10-06 — the hairline is a brush stroke

`held($ink)` replaces `border-left` in both places a note shows its rule: in
the margin (border colour) and opened inline on a narrow screen (accent).
Hover recolours the `::before`, not a border. The note was already floated,
so `position: relative` does not move it; sidenotes.spec's x and overlap
checks pass unchanged.

## 2026-10-06 — notes sit closer to the frame

Asked for directly: the notes were too far out. The 2rem in `--standoff` was
labelled "the grid gutter", but nothing the note has to clear lives there; what
it does have to clear past the ticks is the rail slug. So the term is now
`--rail-band` (1.4rem, set by prelude.scss), the band the slug is centred in,
and the note begins at its far edge. 0.6rem closer than before.

Later the same day: `--rail-band` (1.4rem) became `--margin-gap` (0.2rem), and
the slug no longer sits in a band ahead of the notes; see prelude.scss.md.

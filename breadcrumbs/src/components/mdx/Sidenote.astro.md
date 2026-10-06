# Sidenote.astro

## 2026-10-06 — the hairline is a brush stroke

`held($ink)` replaces `border-left` in both places a note shows its rule: in
the margin (border colour) and opened inline on a narrow screen (accent).
Hover recolours the `::before`, not a border. The note was already floated,
so `position: relative` does not move it; sidenotes.spec's x and overlap
checks pass unchanged.

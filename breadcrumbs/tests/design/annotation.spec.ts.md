# `tests/design/annotation.spec.ts`

## 2026-09-18 — "none of it survives the press" split in two

The print test used to assert that every mark the machine made was absent from
paper, the rail slug included. The slug now prints, so the single test became
two: the boxes and the link marks still have to be gone, and the stamp has to
be there. Splitting rather than loosening keeps the first claim as strict as it
was — a weakened assertion covering both would have stopped catching a tick
that leaked onto paper.

`drawn()` grew the slug's geometry in viewport coordinates. A pseudo-element
has no `getBoundingClientRect`, so its computed `left` — measured from the
article's padding box, which is where an absolutely positioned child begins —
is added to the article's own box. That is what lets the wide test assert the
stamp clears both the frame and the notes, and the print test assert it stands
beside the text block rather than over it.

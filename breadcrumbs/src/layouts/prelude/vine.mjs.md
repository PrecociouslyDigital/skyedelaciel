# vine.mjs

## 2026-10-05 — the contents' pieces share the rules' paint

Ported from the "Vine Contents" prototype
(claude.ai/artifact/EKiepCLszeWXioHecZKLEY), keeping only the chosen
variants: the ring anchor (wire and stone were dropped), the leaf-with-rose
mark (leaf alone and rose alone were dropped), and the curl tip on shoots
(leaf and rose tips were dropped).

`picture()` is the old tail of `vine()`, generalised to more inks (`pot`,
`iron`, `ground`). Rule vines must not move a mark: the ids keep the old key,
and `tests/unit/vine.test.ts` pins a digest computed from the HEAD generator.

`upright` turns the marks themselves a quarter turn rather than wrapping them
in a `<g transform>`, so `picture()` needs no special case. `blooms: false`
guards both `bloom()` and the fallback-rose loop.

The public API is measured in vine widths, not the 40-unit drawing space, so
Sass never needs to know `H`. `shoot` takes `reach` (how far toward the words
it may go, curl included) rather than a run length, so the curl's own reach
stays inside this file.

`hanging` computes its join with `vineStart(seed)` from the same seed as its
section vine, so the shoot lands where the vine starts by construction.
`vineStart` replicates the first random draw of `mainStem` for a flush-left
vine: change the order of draws in `mainStem` and the two stop meeting.

## 2026-10-06 — `chance` moved to chance.mjs

The brush model (brush.mjs) draws from the same seeded PRNG, and importing
it from vine.mjs would have tied the brush to the vines. It was moved
unchanged, so every seed draws what it drew before, and the vine.test.ts
hash pins prove it. The tests that used `chance` for property inputs now
import it from chance.mjs.

## 2026-10-06 — the ring is hung level with its line

`hanging` takes a required `rise`: how far above the top of the section's vine
the middle of the heading's line is, in vine widths. _ornaments.scss passes
half the TOC pitch, and the ring's centre is drawn there. It used to be
hard-coded at 24 units, near the top of the words, which made a top-level
entry harder to pick out by eye. The anchor point and the frame are unchanged,
so the stem still meets the section vine where it did. Changes here reach the
dev server only after a restart, because the Astro config imports this file
once.

Hung exactly at the middle of the cap height, the ring still read as high, so
`$toc-ring-drop` in _ornaments.scss hangs it 2px (0.125rem, scaled) lower. The
`rise` passed to `hanging` is half the pitch minus that drop.

The drop reads right only when the section is open. Folded, with just the
curl under it, the ring looked low, so toc.scss lifts a folded ring's
`summary::before` back by `$toc-ring-drop` with `translate`. It settles as the
section opens, on the same transition as the unrolling frames. The drawing
stays at the open height, because that is where its stem meets the vine.
`translate` composes with the sidebar's mirroring `transform`, so the two
don't conflict.

## 2026-10-06 — `@ts-check`

vine.mjs, brush.mjs, patchwork.mjs and chance.mjs are type-checked, with
JSDoc typedefs for what they export (`Point`, `Traced`, `Mark`, `Ink`,
`Placed`, `Chance`, `Patch`…). `noUncheckedIndexedAccess` applies to JS too,
and these files index arrays everywhere; `nth(list, i)` asserts the element
is there without changing what `list[i]` reads (brush.mjs's `last` replaces
`.at(-1)`, and `nth` is never `.at`, whose negative indexes wrap where `[]`
gives `undefined`). Each rewrite was checked against the built drawings and
masks, which are byte-identical. `INKS` is exported for vines.ts's kinds, and
picture's paint layers are typed against it. `chance` gained `pick(list)`.

## 2026-10-06 — one stalked leaf

`grow()`'s `sprig`, `shoot()`'s leaf loop and `hanging()` each drew a leaf on
a stalk. `stalkedLeaf` takes the differences as options (which way the stalk
curls, how finely it is drawn, how far the blade turns off its end) and
returns the stalk and the blade's heading too, which `sprig` needs to claim
room. Each caller draws its chances in the same order as before, so the
drawings are byte-identical; the golden hash in vine.test.ts confirms it.

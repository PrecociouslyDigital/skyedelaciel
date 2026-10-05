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

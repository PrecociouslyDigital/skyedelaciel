# headings.spec.ts

## 2026-10-06 — rewritten for § numbers

HOLD_MS mirrors CopyLink.svelte's 1500ms. The "lifts" test waits that long
plus 600ms (the grow limit), so it checks the state after the animation has
run, not its timing. motion.spec checks the timing.

# receipt.svelte.ts

## 2026-10-06 — one receipt for both copy buttons

CopyLink had a `Receipt` state machine (shown, leaving, idle) and CopyCode a
`copied` boolean, each with its own `HOLD_MS = 1500` and hold timer; the
design suite restated 1500 too. Both now call `receipt()`, which owns the
hold and the leaving. CopyCode has nothing to animate as it leaves, so it goes
idle at once, which matches what the boolean did. Its stylesheet reads
`data-receipt="shown"` where it read `data-copied`.

`LEAVE_MS` restates receipt.scss's `$leave` for the tests, which have to wait
it out; Sass cannot export it.

# brush.test.ts

## 2026-10-06 — properties first, pins later

"Ruled strays less" compares the same seed both ways. That works because
`brushStroke` draws the hand's drift before anything else, so for one seed
the ruled and free strokes share a centreline wobble and differ only by
`drift` (0.8 against 3) and edge roughness. A comparison per seed is
therefore safe to assert, not merely a statistical tendency. The stray is
measured over x in (200, 1000), clear of the head's swelling and the tail's
filaments.

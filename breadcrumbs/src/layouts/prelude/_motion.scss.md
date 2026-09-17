# \_motion.scss

## 2026-09-17 — the reduced-motion answer travels with the transition

Before this file there were five transitions on the site, in five files, at
five durations, all eased, and no `prefers-reduced-motion` block anywhere in
the repo. The design now says transitions are linear and never longer than
120ms — but a rule stated once in prose and implemented five times is a rule
that will be four-fifths true within a release.

So every transition goes through `snap`, and the two site-wide facts are
properties of the mixin rather than of anyone's memory. The duration limit is
an `@error`, which means a slow transition fails `astro build` naming its own
duration instead of being noticed by eye, or not.

**Why the reduced-motion block is emitted per call site rather than once
globally.** The obvious version is `* { transition-duration: 0s !important }`
in one place. It would work — `!important` on a global selector does beat
Astro's and Svelte's scoped rules, which carry ordinary class specificity. It
is rejected because it is a rule about *everything* used to reach four known
things, and because it is silent: a component that later writes its own
transition by hand would be caught by the global block and would never learn
it had broken the convention. Emitting the answer alongside each transition
means the only way to get an unguarded one is to not use the mixin, which is a
single grep.

The cost is a nested `@media` per call site, which Sass hoists. Six of them
exist. That is the whole cost.

**Longhands, not the shorthand.** The nested block overrides
`transition-duration` alone; a shorthand could only do that by restating the
properties and delays alongside it. stylelint's
`declaration-block-no-redundant-longhand-properties` disagrees and is disabled
on that one line, with the reason beside it.

**Delays are deliberately outside the limit.** `Link.astro` waits 0.3s and
0.4s before the popover appears, and that is not motion — it is the standoff
in time that the anchor's padding is in space, and
`tests/design/links.spec.ts` depends on both. `tests/design/motion.spec.ts`
measures durations for the same reason.

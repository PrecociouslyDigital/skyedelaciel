# colors.scss

## 2026-09-16 — the override selector is written once because it spans three files

A stored scheme choice reaches the page two different ways, and the flash of
the wrong theme came from the two disagreeing.

`html:has(#theme-toggle:checked)` is the no-JS mechanism: the checkbox is the
override, and it works with scripting off but does not survive a reload.
`html[data-theme-checked]` is the pre-paint mechanism: an inline script in
md.astro reads localStorage and stamps the attribute, and ThemeToggle.svelte
clears it once it hydrates and the checkbox can speak for itself.

Both were listed under `@media (prefers-color-scheme: dark)`, but only the
checkbox was listed outside it — so a reader on a light system who had chosen
dark got light until Svelte hydrated. `$override` now holds the pair and is
interpolated into all three blocks, which makes that particular asymmetry
unspellable.

The other half of the fix is in md.astro: the script has to be `is:inline`, or
Astro bundles it as a deferred module and it runs after the paint regardless of
what the CSS says.

## 2026-09-16 — the light scheme's primary is darker than the dark scheme's

`#6185c4` reads at 2.3:1 against the light background, which axe reports as a
serious finding on every navbar link. It is now `#35558d` — the same hue and
saturation, taken down in lightness until it clears WCAG AA at 4.6:1, which is
the lightest it can be and still pass.

`--color-muted` fails the same check from the other direction (too *light* in
the dark scheme, too light in the light one), because `color.scale($lightness:
40%)` moves toward white rather than away from the background. Left alone
pending a decision about what muted should mean.

## 2026-09-17 — the palette is chosen, and the compiler now checks it

The old palette was a placeholder: a blue-grey ground, three tokens nothing
read (`warning`, `error`, `lightscale`), and one the table of contents read
that no theme defined (`--color-fg`, which resolved to nothing). It is now
paper and ink with a vermilion accent, eight tokens, all of them used.

`--color-muted` is the note left open in the entry above. It is no longer
derived. `color.scale($lightness: 40%)` moves a colour toward white, which
makes muted text *lower* contrast in the light scheme and *higher* in the dark
one — it was failing WCAG from one side or the other depending on the scheme.
Both are now picked by hand against their own background: 5.2:1 on paper,
6.5:1 on ink.

Three things are enforced at compile time rather than left to a browser:

- A `$tokens` list, checked in both directions, so a theme that misses a token
  or invents one is an `@error`. This is what makes an unresolvable `var()`
  like `--color-fg` unspellable.
- `_contrast.scss` computes WCAG luminance in Sass, and each theme asserts text
  at 7:1, muted and accent at 4.5:1, and muted quieter than text. These are the
  same claims `tests/design/colors.spec.ts` makes about the rendered page; the
  point of having both is that the compiler answers in a second and names the
  token.
- Each token is declared with `@property { syntax: "<color>" }`, generated from
  the light theme so the initials cannot drift. A non-colour assigned to one now
  falls back to its initial instead of poisoning every rule that reads it.

That last one also fixed a test. `colors.spec.ts` reads `--color-muted` off
`:root` and parses it as `rgb(...)`; it was passing only because
`color.scale` produced fractional channels that Sass could not write as hex. A
plain hex literal would have come back as `#6a6257` and parsed to `NaN`.
Registering the property makes the computed value a resolved colour, which is
what the test was assuming all along.

## 2026-09-17 — three chromas, and one of them is not the designer's

The palette grew from eight tokens to ten. `signal` and `attention` are not
decoration: they are the two halves of a job `accent` had been quietly doing
three different ways. Vermilion was marking provenance (the seal, the front
rule, sidenote numbers), marking *state* (the current entry in the contents),
and marking *interaction* (the underline under a hovered link) — three
meanings one colour cannot hold apart.

They are split by whose hand drew them, not by hue:

- `accent` is the author's. Stamped, rare, permanent.
- `signal` is the machine's. Ambient and constant: it is on the page whether
  or not anyone is looking at it.
- `attention` is right now. It touches exactly one thing and moves when you do.

The useful consequence is that a rule reading `--color-accent` is now a claim
about authorship, and a rule reading `--color-attention` is a claim about
transience. Either can be wrong, and being wrong is visible.

The hues came second. Malachite and ochre are what a Chinese painter had
beside cinnabar, so the machine layer reads as another pigment on the same
page rather than as a screen colour dropped onto it. All three land between
6.2:1 and 6.7:1 on the light ground, which is deliberate: none of them can
shout over the others by contrast, only by where it is used.

## 2026-09-17 — "print is the boldest scheme" is now a build error

`tests/design/colors.spec.ts` asserts that print's text/background contrast
beats both screen schemes'. That was comfortable while the light ground was
eggshell. It is not comfortable now: the light scheme is `#ffffff`, and its
text at 19.1:1 sits two points under print's 21:1 — near enough that an
innocent darkening of `text` would take the margin out.

So the same claim is made here, over the map, after each theme has been
checked on its own. The Playwright test stays: it reads the rendered page,
which is the only place a cascade bug can show up. What moved into the
compiler is the arithmetic, which needs no browser and names the offending
theme in the error.

The light scheme's `text` therefore has a floor it cannot be written below:
strictly lighter than pure black. That is the whole constraint, and it is
otherwise invisible in the file.

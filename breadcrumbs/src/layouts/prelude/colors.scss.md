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

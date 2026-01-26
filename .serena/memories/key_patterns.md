# Key Patterns

## Theme Toggle
CSS-first, works without JS:
- Hidden checkbox `#theme-toggle` in ThemeToggle.svelte
- CSS `:has(#theme-toggle:checked)` inverts theme
- Svelte `onMount` only adds localStorage persistence

## Responsive Breakpoint
`@media (orientation: landscape) and (min-width: 60rem)`
- Landscape: 3-column CSS Grid, navbar sticky in left column
- Portrait: single column, navbar horizontal

## Design Philosophy
See `src/pages/design.mdx` - it's the living spec.
Core: desktop prose reading, graceful mobile degradation, print-first.

# herbarium.ts

## 2026-10-06 — a theme of names, not colours

Shiki inlines every colour, and the reason `syntaxHighlight` was `false` was
that inline colours can't follow the reader's scheme. Here the theme's
"colours" are `var(--tok-<kind>)`, and the transformer turns each into a
class and deletes every `style`, both the token spans' and Astro's on the
`<pre>`. User transformers run after Astro's own `pre` hook, so the deletion
wins. Shiki's built-in `css-variables` theme was rejected because it
collapses numbers and built-ins into one variable, and they are inked
differently here.

Choices beyond the specimen's five classes:
- `PLAIN` beats the broad scopes for operators, CSS property names and JS
  `readwrite`/`object`/`property` names. Without it a script is a wall of
  violet and a stylesheet a wall of mauve. A more specific TextMate scope
  wins, so ordering does not matter.
- String quotes go with their string (`punctuation.definition.string`), and
  `@` with its keyword.
- Weight and italics are left to the stylesheet. The theme sets no
  `fontStyle`, since the transformer would only strip it again.

Shiki's hast writes classes as `class`, not hast's `className`.
herbarium.test.ts reads both.

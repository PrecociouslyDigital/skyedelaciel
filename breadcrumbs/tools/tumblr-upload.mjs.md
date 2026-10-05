# `tools/tumblr-upload.mjs`

## 2026-10-04 — written blind

Tumblr has no API for uploading a theme, so this drives the editor at
`tumblr.com/customize/skyedelaciel` the way a person would. It was written
without a logged-in session to test it against, so every selector is a guess:

- the button opening the HTML editor: role button, name /edit html/i
- the editor: `.cm-content` (CodeMirror 6) or `.CodeMirror textarea`
  (CodeMirror 5) — select-all, then `keyboard.insertText`, which arrives as
  one input event rather than keystrokes, so no auto-indent or auto-closing
- then buttons named /update preview/i and /^save/i

If the editor sits in an iframe, the locators will need `frameLocator`.

Whatever the selectors do, the script only succeeds if the live blog then
carries the built theme's stamp (it polls for two minutes, since Tumblr caches
briefly). The browser profile lives in `~/.cache/skyedelaciel-tumblr`, headed,
so the first run is where you log in.

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

## 2026-10-07 — logging in from .env, also blind

With TUMBLR_EMAIL, TUMBLR_PASSWORD and TUMBLR_TOTP (the authenticator's
base32 secret) in `.env`, the script logs in itself: it fills
`input[type=email]`/`[name=email]`, then `input[type=password]`, then
`[autocomplete=one-time-code]`/`[inputmode=numeric]`, pressing Enter after
each instead of guessing button names. The code is made only once its field
has appeared, so it is fresh. Any step not appearing within 30s gives up on
the automatic login, and the existing 10-minute wait for a manual one takes
over in the same window. `tools/totp.mjs` is RFC 6238, checked against the
RFC's own vectors in `tests/unit/totp.test.ts`.

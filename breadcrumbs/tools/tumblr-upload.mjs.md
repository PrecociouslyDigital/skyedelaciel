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

## 2026-10-07 — first real run: what the editor actually is

Logging in from Playwright's bundled Chrome for Testing failed with Tumblr's
"incorrect login" message, even when the details were typed by hand; the
installed Chrome (`channel: "chrome"`), without `--enable-automation` and with
`AutomationControlled` off, logs in fine.

The theme editor, probed with the session logged in:

- "Edit HTML" is `div#edit_html_button`, not a button.
- The editor is Ace, `#editor`; the theme goes in through
  `host.env.editor.setValue(html, -1)`, which also wakes Tumblr's change
  tracking.
- "Update Preview" and "Save" are `div[data-action="update_preview"]` and
  `div[data-action="save_settings"]`, `.disabled` until there is something to
  do, with hidden copies in other panels, hence `:not(.disabled):visible`.
- A bottom bar offers to submit the theme to Tumblr's garden
  (`data-action="submit_theme"` / `submit_theme_later`); leave it alone.

Tumblr refuses to save a theme with `http://` anywhere in it, even the SVG
namespace inside a data URI; see `src/integrations/tumblr-theme.ts`.

## 2026-10-07 — CI uploads too, unverified from GitHub

`.github/workflows/tumblr-theme.yml` runs `tumblr:check || xvfb-run
tumblr:upload` with the TUMBLR_* repository secrets: headed, in the runner's
preinstalled Chrome, since Tumblr turned away the automated-looking browser at
login. With `CI` set nothing waits for a person: no credentials, or a login
step that does not appear, fails the run within about 30s. CI has no saved
session, so every upload logs in afresh from a datacenter address. Whether
Tumblr challenges that (a new-device email, a captcha) was not known when
this was written; if it does, the run goes red and the fix is the local
upload, as before.

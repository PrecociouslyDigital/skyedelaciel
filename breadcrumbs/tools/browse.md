# browse

## 2026-09-16 — why a daemon rather than a script

Each shell command runs in a fresh process, so an interactive `node` REPL cannot
be held open across calls. The obvious alternative — one Playwright script per
command — loses all page state and pays about a second of browser startup every
time.

Inverting it fixes both: a long-lived daemon owns the browser, and a stateless
client sends it one JSON line per invocation. Scroll position, a toggled theme,
expanded TOC nodes and the console buffer all survive between calls. Measured on
this machine: ~3.5s for the first command (cold daemon), ~30ms for each one
after.

The pieces are split by what has to agree with what, not by size:

- `profiles.mjs` — the viewport × media × JS matrix, the socket/pidfile/log
  paths, and the wire protocol types. Imported by the client, the daemon **and**
  `playwright.config.ts`, so a browser driven by hand and a browser driven by the
  suite cannot drift apart.
- `context.mjs` — opening a page for a profile, and finding the running server.
  Shared with `tools/gallery.mjs`, which needs exactly the same two things.
- `daemon.mjs` — the socket server and the command table.
- `client.mjs` — the CLI. It lives here rather than in `tools/browse` itself
  because an extensionless file is invisible to `astro check`; `tools/browse` is
  a two-line bash `exec` wrapper so the compiler still sees the real code.

## 2026-09-16 — the four ways it dies, and the one that needed designing

Idle timeout (10 minutes), explicit `stop`, SIGTERM/SIGINT, and source-hash
mismatch. Three of those are ordinary. The fourth and the unclean case are not:

**Source-hash mismatch.** A running daemon serves the profile table it started
with. Editing `profiles.mjs` and seeing no change would be an hour of confused
debugging, so the daemon hashes every `.mjs` beside it at startup, the client
sends that hash with every command, and a mismatch makes the daemon stand down
so the client can start a successor. The hash is over `readdirSync` rather than a
listed set of files, so a module added later is covered without anyone
remembering to add it — which is how `context.mjs` got covered for free.

**Unclean death.** If the daemon is SIGKILLed, its socket file survives on disk,
so "the file exists" proves nothing. The client's path is therefore: connect →
on `ECONNREFUSED`, unlink the stale socket → spawn a fresh daemon. A refused
connection is the *only* signal that distinguishes "gone" from "never started",
and it is also the moment the leftover file is known to be safe to remove.
Binding the socket is itself the single-instance lock, so there is no separate
lockfile that could disagree with reality.

The idle timer compares `Date.now()` against the last-command timestamp on an
interval, rather than arming a one-shot `setTimeout`. A laptop that sleeps
through the idle window still reaps on wake.

## 2026-09-16 — `launchServer` instead of `launch`

`chromium.launch()` returns a `Browser` with no way to get at the underlying
process id. `launchServer()` + `connect()` costs one websocket hop and gives
`server.process().pid`, which is what lets the pidfile record the chromium pid
alongside the daemon's — so `browse stop --force` can reap a browser that
outlived its parent.

In practice that orphan did not reproduce: `kill -9` on the daemon closes the
pipe Playwright holds the browser on, and chromium exits by itself. The pidfile
is therefore a cheap net for a case that has not actually been observed, not a
fix for a known leak. It costs one `writeFileSync` at startup, so it stays.

## 2026-09-16 — things that turned out not to be true

- `page.evaluate` **does** work with `javaScriptEnabled: false`. Playwright
  evaluates in a utility world that stays enabled, so the `nojs` profile can
  still be measured and can still run axe. Verified, not assumed.
- Playwright's screenshot `scale` option is `"css" | "device"`, not a number.
  `--scale N` therefore rebuilds the profile's context with a new
  `deviceScaleFactor` and returns to the page it was on, since that factor is
  fixed when a context is built. It is sticky until changed again.
- ImageMagick here is built with no font discovery at all — `magick -list font`
  is empty, and even `-font Helvetica` fails. Captions need a font **file path**,
  so `tools/gallery.mjs` probes a few known paths and silently drops labels if
  none exist rather than failing the run.

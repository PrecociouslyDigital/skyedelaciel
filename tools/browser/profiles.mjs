// @ts-check
/**
 * Everything the browse client, the browse daemon and playwright.config.ts
 * must agree on: which browsers exist, where the daemon lives, and how to tell
 * a running daemon apart from a stale one.
 *
 * Kept in one file because the failure it prevents is silent: a matrix that
 * drifts between the browser I drive by hand and the browser the suite drives
 * makes a passing test and a broken page indistinguishable.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** The repository root — `tools/browser/` is two levels down from it. */
export const repoRoot = resolve(here, "../..");

// ─── The matrix ──────────────────────────────────────────────────────────────

/**
 * @typedef {object} Profile
 * @property {{ width: number, height: number }} viewport
 * @property {"screen" | "print"} media       CSS media type to emulate
 * @property {boolean} javaScriptEnabled
 * @property {string} checks                  what this profile exists to verify
 */

/**
 * The four browsers, taken from the "Wide viewports / Narrow viewports / Print"
 * subheadings that structure src/content/design.mdx, plus the one place the
 * spec says a behaviour must survive without JavaScript.
 *
 * The widths straddle the two breakpoints in
 * src/layouts/prelude/_breakpoints.scss: `wide` is 60rem (960px) and
 * `wide-sidebar` is 72rem (1152px).
 *
 * @satisfies {Record<string, Profile>}
 */
export const profiles = {
    wide: {
        viewport: { width: 1600, height: 1000 },
        media: "screen",
        javaScriptEnabled: true,
        checks: "sidebar navbar, sticky TOC, sidenotes in the margin",
    },
    narrow: {
        viewport: { width: 420, height: 900 },
        media: "screen",
        javaScriptEnabled: true,
        checks: "inline navbar, collapsed TOC, sidenotes hidden until tapped",
    },
    print: {
        viewport: { width: 1600, height: 1000 },
        media: "print",
        javaScriptEnabled: true,
        checks: "no navbar, TOC fully expanded, links as plain text",
    },
    nojs: {
        viewport: { width: 1600, height: 1000 },
        media: "screen",
        javaScriptEnabled: false,
        checks: 'the spec\'s "should not require javascript" claim',
    },
};

/** @typedef {keyof typeof profiles} ProfileName */

/** @type {ProfileName[]} */
export const profileNames = /** @type {ProfileName[]} */ (
    Object.keys(profiles)
);

/** @type {ProfileName} */
export const defaultProfile = "wide";

export const devPort = 4321;
export const previewPort = 4322;

/**
 * The test suite's own port, deliberately not one of the two above. It serves a
 * fixture build, and sharing a port with the server the user happens to be
 * running would mean the suite silently testing whatever that build contained.
 */
export const testPort = 4323;

/**
 * Where `tools/browse` looks for a running site, in order. It never starts one
 * — per CLAUDE.md the dev server is the user's to run — but it will happily
 * drive the suite's server if that is what is up.
 */
export const serverPorts = [devPort, previewPort, testPort];

// ─── The wire protocol ───────────────────────────────────────────────────────

/**
 * One command, as the client sends it.
 *
 * The client resolves everything that depends on where and when it was invoked
 * — the working directory, the output directory, `$BROWSE_BASE` — because the
 * daemon's own environment is frozen at whatever happened to spawn it.
 *
 * @typedef {object} Request
 * @property {string} hash                fingerprint of the source the client read
 * @property {ProfileName} profile
 * @property {string} cwd                 what relative `-o` paths resolve against
 * @property {string} outDir              where unnamed screenshots land
 * @property {string | undefined} base    $BROWSE_BASE, as the client saw it
 * @property {string[]} argv              command and its arguments
 */

/**
 * One reply. `code` distinguishes a mistyped command (`USAGE`) from a command
 * that ran and failed (`FAILED`) from a daemon standing down (`STALE`).
 *
 * @typedef {object} Reply
 * @property {boolean} ok
 * @property {unknown} [result]
 * @property {"USAGE" | "FAILED" | "STALE"} [code]
 * @property {string} [error]
 */

// ─── Where the daemon lives ──────────────────────────────────────────────────

/** Binding this socket is also the daemon's single-instance lock. */
export const socketPath = join(repoRoot, ".browse.sock");

/** Records the daemon and chromium pids, so a killed daemon can still be reaped. */
export const pidfilePath = join(repoRoot, ".browse.pid");

/** The daemon's only output channel; the client tails it when a spawn fails. */
export const logPath = join(repoRoot, ".browse.log");

/**
 * Fingerprint of the daemon's source. A running daemon serves the tables it
 * started with, so the client sends this along and a daemon whose source has
 * since changed exits rather than answering out of a stale profile table.
 *
 * Hashing the whole directory rather than a listed set means a module added
 * here is covered without anyone remembering to add it.
 */
export function sourceHash() {
    const hash = createHash("sha256");
    for (const file of readdirSync(here).sort()) {
        if (file.endsWith(".mjs")) hash.update(readFileSync(join(here, file)));
    }
    return hash.digest("hex").slice(0, 16);
}

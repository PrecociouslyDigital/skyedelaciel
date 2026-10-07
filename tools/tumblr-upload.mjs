#!/usr/bin/env node
// @ts-check
/**
 * Put dist-tumblr/theme.html on the blog, by doing what a person would: open
 * Tumblr's theme editor in a browser, replace the HTML, and save.
 *
 * Tumblr offers no API for this, so the script drives the editor itself, and
 * the editor is Tumblr's to change. It therefore checks its own work: once
 * saved, the live blog has to carry the stamp of the theme just built, or the
 * script fails — a changed editor makes it fail loudly rather than pass.
 *
 * The browser keeps its profile outside the repository and is shown rather
 * than headless, so later runs reuse the session. When there is no session
 * yet, the script logs in with the TUMBLR_EMAIL, TUMBLR_PASSWORD and
 * TUMBLR_TOTP (the authenticator's base32 secret) in the repository's .env,
 * if it has all three; otherwise, or if Tumblr's login page has changed, by
 * hand in the window the script opened.
 */

import { chromium } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { repoRoot } from "./root.mjs";
import { builtStamp, liveStamp, THEME } from "./tumblr-check.mjs";
import { totp } from "./totp.mjs";

const PROFILE = join(homedir(), ".cache", "skyedelaciel-tumblr");
const EDITOR = "https://www.tumblr.com/customize/skyedelaciel";

/** Long enough to log in by hand, on the first run. */
const LOGIN = 10 * 60_000;
/** Tumblr caches a blog's pages briefly after its theme is saved. */
const SETTLE = 2 * 60_000;
/** How long each field of the login may take to appear. */
const STEP = 30_000;

const ENV = join(repoRoot, ".env");
if (existsSync(ENV)) process.loadEnvFile(ENV);

/** All three, or none, so a login is never half attempted. */
function credentials() {
    const { TUMBLR_EMAIL, TUMBLR_PASSWORD, TUMBLR_TOTP } = process.env;
    return TUMBLR_EMAIL && TUMBLR_PASSWORD && TUMBLR_TOTP
        ? {
              email: TUMBLR_EMAIL,
              password: TUMBLR_PASSWORD,
              secret: TUMBLR_TOTP,
          }
        : undefined;
}

/**
 * Fill in Tumblr's login one step at a time, each submitted with Enter rather
 * than by a button whose name could change: the email, the password, then the
 * authenticator's code, made as late as possible so it has not expired.
 * @param {import("@playwright/test").Page} page
 * @param {NonNullable<ReturnType<typeof credentials>>} login
 */
async function logIn(page, { email, password, secret }) {
    /** @type {(selector: string, value: () => string) => Promise<void>} */
    const field = async (selector, value) => {
        const input = page.locator(selector).first();
        await input.waitFor({ timeout: STEP });
        await input.fill(value());
        await input.press("Enter");
    };
    await field('input[type="email"], input[name="email"]', () => email);
    await field('input[type="password"]', () => password);
    await field(
        'input[autocomplete="one-time-code"], input[inputmode="numeric"]',
        () => totp(secret),
    );
}

const context = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    viewport: null,
});
const page = context.pages()[0] ?? (await context.newPage());

try {
    await page.goto(EDITOR);
    if (!page.url().startsWith(EDITOR)) {
        const login = credentials();
        if (login) {
            await logIn(page, login).catch(() =>
                console.error(
                    "Could not log in from .env; finish logging in in the browser window.",
                ),
            );
        }
        await page.waitForURL((url) => !/login|register/.test(url.pathname), {
            timeout: LOGIN,
        });
        await page.goto(EDITOR);
    }

    await page.getByRole("button", { name: /edit html/i }).click();
    const editor = page.locator(".cm-content, .CodeMirror textarea").first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.insertText(readFileSync(THEME, "utf8"));
    await page.getByRole("button", { name: /update preview/i }).click();
    await page.getByRole("button", { name: /^save/i }).click();

    const built = builtStamp();
    const deadline = Date.now() + SETTLE;
    let live = await liveStamp();
    while (live !== built && Date.now() < deadline) {
        await page.waitForTimeout(5_000);
        live = await liveStamp();
    }
    if (live !== built) {
        console.error(
            `Saved, but the blog still wears theme ${live ?? "(unstamped)"}, not ${built}. ` +
                "Tumblr's editor may have changed; see breadcrumbs/tools/tumblr-upload.mjs.md.",
        );
        process.exitCode = 1;
    }
} finally {
    await context.close();
}

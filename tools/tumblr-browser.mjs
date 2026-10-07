// @ts-check
/**
 * A Chrome window on Tumblr's theme editor, logged in, for the scripts that
 * work there: tumblr-upload.mjs, which puts the theme on the blog, and
 * tumblr-session.mjs, which hands the session on to CI.
 *
 * The browser keeps its profile outside the repository and is shown rather
 * than headless, so later runs reuse the session. CI has no profile, and a
 * fresh login from a datacenter is turned away at Tumblr's second step, so it
 * brings TUMBLR_SESSION instead: the tumblr.com cookies tumblr-session.mjs
 * stored, as the JSON of Playwright's `context.cookies()`. With no session,
 * the script logs in with the TUMBLR_EMAIL, TUMBLR_PASSWORD and TUMBLR_TOTP
 * (the authenticator's base32 secret) from the environment or the
 * repository's .env, if either has all three; otherwise, or if Tumblr's login
 * page has changed, by hand in the window the script opened.
 */

import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { repoRoot } from "./root.mjs";
import { totp } from "./totp.mjs";

const PROFILE = join(homedir(), ".cache", "skyedelaciel-tumblr");
const EDITOR = "https://www.tumblr.com/customize/skyedelaciel";

/**
 * Whether someone is at the window to finish a login the script could not.
 * In CI no one is, so a failed login fails at once.
 */
const ATTENDED = !process.env.CI;
/** Long enough to log in by hand, on the first run. */
const LOGIN = ATTENDED ? 10 * 60_000 : 30_000;
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

/**
 * What Tumblr showed when a run in CI failed, for the workflow to keep: a
 * picture of the page, with every field blanked, since the repository and so
 * its artifacts are public.
 */
const FAILURE = join(repoRoot, "dist-tumblr", "failure.png");

/**
 * Do `work` in the theme editor, logged in, and close the browser after. If
 * either fails in CI, first log the page's origin and path, without its query,
 * and save FAILURE.
 * @template T
 * @param {(page: import("@playwright/test").Page, context: import("@playwright/test").BrowserContext) => Promise<T>} work
 */
export async function withEditor(work) {
    // Tumblr refuses a login, as though the password were wrong, from a
    // browser that says it is automated, so this is the installed Chrome, not
    // making that claim.
    const context = await chromium.launchPersistentContext(PROFILE, {
        channel: "chrome",
        headless: false,
        viewport: null,
        ignoreDefaultArgs: ["--enable-automation"],
        args: ["--disable-blink-features=AutomationControlled"],
    });
    const page = context.pages()[0] ?? (await context.newPage());

    try {
        if (process.env.TUMBLR_SESSION)
            await context.addCookies(JSON.parse(process.env.TUMBLR_SESSION));

        await page.goto(EDITOR);
        if (!page.url().startsWith(EDITOR)) {
            const login = credentials();
            if (!login && !ATTENDED)
                throw new Error(
                    "No TUMBLR_SESSION, or one that has expired, and no TUMBLR_EMAIL, TUMBLR_PASSWORD and TUMBLR_TOTP to log in with.",
                );
            if (login) {
                await logIn(page, login).catch((error) => {
                    if (!ATTENDED) throw error;
                    console.error(
                        "Could not log in from .env; finish logging in in the browser window.",
                    );
                });
            }
            await page.waitForURL(
                (url) => !/login|register/.test(url.pathname),
                { timeout: LOGIN },
            );
            await page.goto(EDITOR);
        }

        return await work(page, context);
    } catch (error) {
        if (!ATTENDED) {
            const { origin, pathname } = new URL(page.url());
            console.error(`Tumblr was showing ${origin}${pathname}.`);
            await page.screenshot({
                path: FAILURE,
                fullPage: true,
                mask: [page.locator("input, textarea")],
            });
        }
        throw error;
    } finally {
        await context.close();
    }
}

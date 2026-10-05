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
 * than headless, so the first run is a chance to log in, and later runs reuse
 * the session.
 */

import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { builtStamp, liveStamp, THEME } from "./tumblr-check.mjs";

const PROFILE = join(homedir(), ".cache", "skyedelaciel-tumblr");
const EDITOR = "https://www.tumblr.com/customize/skyedelaciel";

/** Long enough to log in by hand, on the first run. */
const LOGIN = 10 * 60_000;
/** Tumblr caches a blog's pages briefly after its theme is saved. */
const SETTLE = 2 * 60_000;

const context = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    viewport: null,
});
const page = context.pages()[0] ?? (await context.newPage());

try {
    await page.goto(EDITOR);
    if (!page.url().startsWith(EDITOR)) {
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

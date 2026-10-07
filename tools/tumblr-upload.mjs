#!/usr/bin/env node
// @ts-check
/**
 * Put dist-tumblr/theme.html on the blog, by doing what a person would: open
 * Tumblr's theme editor in a browser, replace the HTML, and save.
 *
 * Tumblr offers no API for this, so the script drives the editor itself, and
 * the editor is Tumblr's to change. It therefore checks its own work: once
 * saved, the live blog has to carry the stamp of the theme just built, or the
 * script fails — a changed editor makes it fail loudly rather than pass. How
 * it gets into the editor, logged in, is tumblr-browser.mjs's.
 */

import { readFileSync } from "node:fs";
import { withEditor } from "./tumblr-browser.mjs";
import { builtStamp, liveStamp, THEME } from "./tumblr-check.mjs";

/** Tumblr caches a blog's pages briefly after its theme is saved. */
const SETTLE = 2 * 60_000;

await withEditor(async (page) => {
    // The editor is Ace, so the theme goes in through Ace's own API rather than
    // typing, which Ace would indent and pair brackets in. Its buttons are divs,
    // disabled until there is something to preview or save, and the panels each
    // keep a copy of them, hidden but for the one shown.
    await page.locator("#edit_html_button").click();
    await page
        .locator("#editor")
        .evaluate(
            (host, html) =>
                /** @type {any} */ (host).env.editor.setValue(html, -1),
            readFileSync(THEME, "utf8"),
        );
    const button = (/** @type {string} */ action) =>
        page.locator(`[data-action="${action}"]:not(.disabled):visible`);
    await button("update_preview").click();
    await button("save_settings").click();

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
});

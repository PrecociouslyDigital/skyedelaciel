#!/usr/bin/env node
// @ts-check
/**
 * Is the blog wearing the theme that was just built?
 *
 * Tumblr has no API for themes, so nothing but a person puts one there, and
 * nothing but this notices when they have not. It compares the stamp on the
 * live blog with the stamp on dist-tumblr/theme.html, silently when they
 * match. CI runs it after every build of `release`; the upload script runs it
 * to confirm its own work.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TUMBLR } from "../src/components/nav.ts";
import { readStamp } from "../src/tumblr/stamp.mjs";

export const THEME = fileURLToPath(
    new URL("../dist-tumblr/theme.html", import.meta.url),
);

export const builtStamp = () => readStamp(readFileSync(THEME, "utf8"));

export async function liveStamp() {
    const response = await fetch(TUMBLR, { cache: "no-store" });
    return readStamp(await response.text());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const [built, live] = [builtStamp(), await liveStamp()];
    if (built !== live) {
        console.error(
            `${TUMBLR} is wearing theme ${live ?? "(unstamped)"}, not ${built}. ` +
                "Run `npm run tumblr:upload`, or paste dist-tumblr/theme.html into the theme editor.",
        );
        process.exitCode = 1;
    }
}

// @ts-check
/**
 * Which build of the theme a page of the blog was served by.
 *
 * The theme carries a hash of itself in a meta tag. The build stamps it; CI
 * and the upload script read it back off the live blog and compare it with the
 * one just built, which is how a theme that was never pasted into Tumblr is
 * caught. Plain JS, so that the tools can import it without a compiler.
 *
 * The hash is of the theme's own content, not of the commit it was built
 * from, so a commit that leaves the theme alone does not make it stale.
 */

import { createHash } from "node:crypto";

/** Written by the theme; replaced by its hash when the build stamps it. */
export const THEME_HASH_PLACEHOLDER = "__THEME_HASH__";

const META = /(<meta\s+name="theme-hash"\s+content=")([^"]*)(")/;

/**
 * The hash of a theme, taken with its own stamp blanked out, so that stamping
 * a stamped theme changes nothing.
 * @param {string} html
 */
export function themeHash(html) {
    const blank = html.replace(META, `$1${THEME_HASH_PLACEHOLDER}$3`);
    return createHash("sha256").update(blank).digest("hex").slice(0, 16);
}

/** @param {string} html */
export function stamp(html) {
    if (!META.test(html)) throw new Error("The theme has no theme-hash meta.");
    return html.replace(META, `$1${themeHash(html)}$3`);
}

/**
 * The stamp a page carries, if any.
 * @param {string} html
 */
export function readStamp(html) {
    return META.exec(html)?.[2];
}

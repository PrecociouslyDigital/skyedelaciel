// @ts-check
/**
 * The two things every browser in this repo needs before it can be useful:
 * a page set up for a profile, and somewhere to point it.
 *
 * Shared by the daemon and by tools/gallery.mjs so that a screenshot in the
 * gallery and a screenshot from `tools/browse` are of the same browser.
 */

import { profiles, serverPorts } from "./profiles.mjs";

/** @typedef {import("./profiles.mjs").ProfileName} ProfileName */

/**
 * Open a context and page configured for one profile.
 *
 * `deviceScaleFactor` is fixed when a context is built rather than when a
 * screenshot is taken, which is why it belongs here and not at the call site.
 *
 * @param {import("playwright").Browser} browser
 * @param {ProfileName} name
 * @param {number} scale
 */
export async function openProfilePage(browser, name, scale = 1) {
    const profile = profiles[name];
    const context = await browser.newContext({
        viewport: profile.viewport,
        javaScriptEnabled: profile.javaScriptEnabled,
        deviceScaleFactor: scale,
    });
    const page = await context.newPage();
    await page.emulateMedia({ media: profile.media });
    return { context, page, scale };
}

/** Any answer at all — a 404 included — means something is listening. */
export async function isUp(/** @type {string} */ origin) {
    try {
        await fetch(origin, { signal: AbortSignal.timeout(700) });
        return true;
    } catch {
        return false;
    }
}

/**
 * Find the origin serving the site, preferring `$BROWSE_BASE` when one is set.
 * Never starts a server: per CLAUDE.md the dev server is the user's to run.
 *
 * @param {string | undefined} override
 */
export async function resolveBaseUrl(override) {
    const candidates = override
        ? [override]
        : serverPorts.map((port) => `http://localhost:${port}`);

    for (const candidate of candidates) {
        if (await isUp(candidate)) return candidate;
    }
    throw new Error(
        `nothing is serving the site at ${candidates.join(" or ")} — ` +
            "start `npm run dev`, or `npm run build:fixtures && npm run preview`",
    );
}

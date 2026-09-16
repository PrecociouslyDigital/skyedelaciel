// @ts-check
/**
 * Render every page and component across every profile, then tile the results
 * into labelled contact sheets with ImageMagick.
 *
 * The tiling is the point. Thirty separate PNGs is thirty separate looks;
 * one sheet per component, with the four profiles side by side, is one. This
 * exists for the judgements assertions cannot make — "visually set apart",
 * "padded pleasantly", "less visually notable than most text" — so nothing
 * here is a baseline and nothing here is committed.
 *
 *   npm run gallery      → .gallery/index.html
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { openProfilePage, resolveBaseUrl } from "./browser/context.mjs";
import { profileNames, profiles, repoRoot } from "./browser/profiles.mjs";

/** @typedef {import("playwright").Page} Page */
/** @typedef {{ x: number, y: number, width: number, height: number }} Region */

const OUT = join(repoRoot, ".gallery");
const PAGES = { design: "/design/", fixture: "/fixtures/kitchen-sink/" };

/** Breathing room around a cropped component, so it is not cut to the pixel. */
const PAD = 12;

/**
 * The padded bounding box of the first of these selectors that is actually
 * rendered. Null when none of them are — a navbar under `print`, say, which is
 * absent by design rather than broken.
 *
 * Coordinates are relative to the document rather than the viewport, because
 * these are cropped out of full-page screenshots and most of what we want to
 * see is below the fold.
 *
 * @param {Page} page
 * @param {string[]} selectors
 * @returns {Promise<Region | null>}
 */
async function firstVisible(page, selectors) {
    for (const selector of selectors) {
        const box = await page
            .locator(selector)
            .first()
            .evaluate((element) => {
                const rect = element.getBoundingClientRect();
                return {
                    x: rect.x + window.scrollX,
                    y: rect.y + window.scrollY,
                    width: rect.width,
                    height: rect.height,
                };
            })
            .catch(() => null);
        if (box && box.width > 0 && box.height > 0) {
            return {
                x: Math.max(0, box.x - PAD),
                y: Math.max(0, box.y - PAD),
                width: box.width + PAD * 2,
                height: box.height + PAD * 2,
            };
        }
    }
    return null;
}

/** Trim a region to the rendered document, so a crop can never fall outside it. */
async function clampToPage(
    /** @type {Page} */ page,
    /** @type {Region} */ region,
) {
    const { width, height } = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
    }));
    const x = Math.max(0, Math.min(region.x, width - 1));
    const y = Math.max(0, Math.min(region.y, height - 1));
    return {
        x,
        y,
        width: Math.max(1, Math.min(region.width, width - x)),
        height: Math.max(1, Math.min(region.height, height - y)),
    };
}

/**
 * One crop of one page.
 *
 * @typedef {object} Shot
 * @property {string} name
 * @property {keyof typeof PAGES} on
 * @property {(page: Page) => Promise<Region | null>} region
 */

/** @type {Shot[]} */
const SHOTS = [
    {
        name: "front-matter",
        on: "fixture",
        region: (page) => firstVisible(page, [".front-matter"]),
    },
    {
        name: "navbar",
        on: "design",
        region: (page) => firstVisible(page, [".navbar"]),
    },
    {
        name: "table-of-contents",
        on: "fixture",
        region: async (page) => {
            // The portrait TOC is collapsed until asked; open it so the sheet
            // shows the contents rather than a single word.
            const toggle = page.locator(
                '.toc-portrait label[for="toc-toggle"]',
            );
            if (await toggle.isVisible().catch(() => false)) {
                await toggle.click();
                await page.waitForTimeout(400);
            }
            return firstVisible(page, [".toc-sidebar", ".toc-portrait"]);
        },
    },
    {
        name: "sidenotes",
        on: "fixture",
        region: async (page) => {
            const note = page.locator("article small[role='note']").first();
            if (!(await note.isVisible().catch(() => false))) {
                // Narrow viewports hide notes until the marker is tapped.
                await page
                    .locator("article label[role='doc-noteref']")
                    .first()
                    .click()
                    .catch(() => {});
            }
            const marker = await firstVisible(page, [".sidenote-wrapper"]);
            const body = await firstVisible(page, [
                "article small[role='note']",
            ]);
            if (!marker || !body) return marker ?? body;
            // Both the marker and the note it belongs to, in one frame.
            const top = Math.min(marker.y, body.y);
            const left = Math.min(marker.x, body.x);
            return {
                x: left,
                y: top,
                width:
                    Math.max(marker.x + marker.width, body.x + body.width) -
                    left,
                height:
                    Math.max(marker.y + marker.height, body.y + body.height) -
                    top,
            };
        },
    },
    {
        name: "link-popover",
        on: "fixture",
        region: async (page) => {
            const wrapper = page.locator(".link-wrapper").first();
            await wrapper
                .locator("a")
                .hover()
                .catch(() => {});
            await page.waitForTimeout(600); // the popover fades in on a delay
            const popover = await firstVisible(page, [".link-popover"]);
            const link = await firstVisible(page, [".link-wrapper"]);
            if (!popover) return link;
            const bottom = link
                ? link.y + link.height
                : popover.y + popover.height;
            return {
                x: popover.x,
                y: popover.y,
                width: popover.width,
                height: bottom - popover.y,
            };
        },
    },
    {
        name: "bibliography",
        on: "fixture",
        region: (page) => firstVisible(page, [".bibliography"]),
    },
];

/**
 * A font ImageMagick can actually load. The local build has no font discovery
 * at all (`magick -list font` is empty), so text has to be given a file path.
 * Without one the sheets still tile — they just lose their captions.
 */
const FONT = [
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
].find((path) => existsSync(path));

/**
 * Tile a set of PNGs into one sheet, captioned with each tile's profile.
 * @param {string[]} inputs
 * @param {string} title
 * @param {string} output
 */
function montage(inputs, title, output) {
    const captions = FONT
        ? ["-font", FONT, "-pointsize", "22", "-label", "%t", "-title", title]
        : [];
    execFileSync("magick", [
        "montage",
        "-background",
        "#2b2b2b",
        "-fill",
        "#e8e8e8",
        ...captions,
        "-geometry",
        "560x900>+12+16",
        "-tile",
        `${profileNames.length}x`,
        ...inputs,
        output,
    ]);
}

async function main() {
    const base = await resolveBaseUrl(process.env.BROWSE_BASE);
    rmSync(OUT, { recursive: true, force: true });

    const browser = await chromium.launch({ headless: true });
    /** @type {{ name: string, sheet: string }[]} */
    const sheets = [];

    // A full page per profile, plus one crop per component per profile.
    /** @type {Map<string, string[]>} */
    const collected = new Map();

    for (const profileName of profileNames) {
        const { context, page } = await openProfilePage(
            browser,
            profileName,
            2,
        );

        for (const [key, path] of Object.entries(PAGES)) {
            await page.goto(new URL(path, base).href, { waitUntil: "load" });

            const pageShot = join(
                OUT,
                "shots",
                `page-${key}`,
                `${profileName}.png`,
            );
            mkdirSync(join(OUT, "shots", `page-${key}`), { recursive: true });
            await page.screenshot({ path: pageShot, fullPage: true });
            collected.set(`page-${key}`, [
                ...(collected.get(`page-${key}`) ?? []),
                pageShot,
            ]);

            for (const shot of SHOTS.filter((s) => s.on === key)) {
                const region = await shot.region(page);
                if (!region) continue; // absent in this profile, by design

                const file = join(
                    OUT,
                    "shots",
                    shot.name,
                    `${profileName}.png`,
                );
                mkdirSync(join(OUT, "shots", shot.name), { recursive: true });
                await page.screenshot({
                    path: file,
                    fullPage: true,
                    clip: await clampToPage(page, region),
                });
                collected.set(shot.name, [
                    ...(collected.get(shot.name) ?? []),
                    file,
                ]);
            }
        }

        await context.close();
    }

    await browser.close();

    mkdirSync(join(OUT, "sheets"), { recursive: true });
    for (const [name, inputs] of collected) {
        const sheet = join(OUT, "sheets", `${name}.png`);
        montage(inputs, name, sheet);
        sheets.push({ name, sheet });
    }

    writeFileSync(join(OUT, "index.html"), indexHtml(sheets, base), "utf8");
    process.stdout.write(`${join(OUT, "index.html")}\n`);
}

/**
 * @param {{ name: string, sheet: string }[]} sheets
 * @param {string} base
 */
function indexHtml(sheets, base) {
    const rows = sheets
        .map(
            ({ name }) =>
                `<section><h2>${name}</h2><img src="sheets/${name}.png" alt="${name}"></section>`,
        )
        .join("\n");

    return `<!doctype html>
<meta charset="utf-8">
<title>Gallery</title>
<style>
  body { background: #1b1b1b; color: #e8e8e8; font: 15px/1.5 system-ui, sans-serif; margin: 2rem auto; max-width: 80rem; padding: 0 1rem; }
  h1 { font-weight: 600; }
  p.meta { color: #9a9a9a; }
  section { margin: 2.5rem 0; }
  img { max-width: 100%; border: 1px solid #3a3a3a; }
</style>
<h1>Gallery</h1>
<p class="meta">${sheets.length} contact sheets · profiles: ${profileNames
        .map((name) => `${name} (${profiles[name].checks})`)
        .join(
            " · ",
        )}<br>rendered from ${base} at ${new Date().toISOString()}</p>
${rows}
`;
}

await main();

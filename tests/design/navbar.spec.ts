import { profiles } from "../../tools/browser/profiles.mjs";
import { box, expect, onlyIn, section, SPEC_PAGE, test } from "./_harness";
import type { Page } from "@playwright/test";

/** The navbar's three parts, in the order the spec lists them. */
const PARTS = [".logo", ".nav-links", ".theme-toggle"];

/**
 * Where the parts sit relative to each other.
 *
 * Measured rather than read off `flex-direction`, because "arranged
 * vertically" is a claim about what a reader sees: a grid or a column of
 * blocks would satisfy the spec just as well as a flex column does.
 */
const arrangement = (parts: readonly string[]) => {
    const boxes = parts.map((part) =>
        document.querySelector(part)!.getBoundingClientRect(),
    );
    const pairs = boxes
        .slice(1)
        .map((box, index) => ({ previous: boxes[index]!, box }));

    if (pairs.every(({ previous, box }) => box.top >= previous.bottom))
        return "stacked";
    if (pairs.every(({ previous, box }) => box.left >= previous.right))
        return "side-by-side";
    return "neither";
};

/**
 * Laid out as on a narrow page: across the top of the article, above its
 * title, and as wide as it.
 */
async function inTheBand(page: Page) {
    const navbar = await box(page.locator(".navbar"));
    const title = await box(page.locator(".title"));
    const article = await box(page.locator("article"));

    expect(navbar.y + navbar.height).toBeLessThanOrEqual(title.y);
    expect(await page.evaluate(arrangement, PARTS)).toBe("side-by-side");
    expect(navbar.width).toBeCloseTo(article.width, 0);
}

section("Navbar", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(SPEC_PAGE);
    });

    section("Content", () => {
        onlyIn("wide", "narrow", "nojs");

        test("a logo home, then links, then the scheme toggle", async ({
            page,
        }) => {
            const navbar = page.locator(".navbar");
            await expect(navbar.locator(".logo")).toHaveAttribute("href", "/");

            // Compared by document position rather than child index, so a
            // part may be wrapped in an element of its own without moving.
            const positions = await navbar.evaluate((nav, parts) => {
                const everything = [...document.querySelectorAll("*")];
                return parts.map((part) => {
                    const element = nav.querySelector(part);
                    return element ? everything.indexOf(element) : -1;
                });
            }, PARTS);

            expect(
                positions,
                "logo, links and toggle are all present",
            ).not.toContain(-1);
            expect(positions, "and they appear in that order").toEqual(
                [...positions].sort((a, b) => a - b),
            );
            await expect(navbar.locator(".nav-links a")).not.toHaveCount(0);
        });

        test("its links are Fiction, Nonfiction and Tumblr", async ({
            page,
        }) => {
            await expect(page.locator(".navbar .nav-links a")).toHaveText([
                /fiction/i,
                /nonfiction/i,
                /tumblr/i,
            ]);
        });
    });

    section("Wide viewports", () => {
        onlyIn("wide", "nojs");

        test("it sits beside the content, arranged vertically", async ({
            page,
        }) => {
            const navbar = await box(page.locator(".navbar"));
            const article = await box(page.locator("article"));

            // Beside, not above: it ends before the content begins.
            expect(navbar.x + navbar.width).toBeLessThanOrEqual(article.x);
            expect(await page.evaluate(arrangement, PARTS)).toBe("stacked");
        });

        test("it is right-aligned to the content's left edge", async ({
            page,
        }) => {
            const { navRight, articleLeft, gap } = await page.evaluate(() => {
                const navbar = document
                    .querySelector(".navbar")!
                    .getBoundingClientRect();
                const article = document
                    .querySelector("article")!
                    .getBoundingClientRect();
                return {
                    navRight: navbar.right,
                    articleLeft: article.left,
                    gap: parseFloat(
                        getComputedStyle(document.body).columnGap || "0",
                    ),
                };
            });
            // Flush, allowing for the grid gutter that separates the columns.
            expect(articleLeft - navRight).toBeCloseTo(gap, 0);
        });
    });

    section("Room for sidenotes, not yet for the navbar's column", () => {
        onlyIn("wide", "nojs");

        // Between `wide` (60rem) and `wide-sidebar` (80rem).
        test.use({ viewport: { width: 1100, height: 900 } });

        test("it is horizontal, above the title, matching the measure", ({
            page,
        }) => inTheBand(page));
    });

    section("Narrow viewports", () => {
        onlyIn("narrow");

        test("it is horizontal, above the title, matching the measure", ({
            page,
        }) => inTheBand(page));

        /** The phone widths the band is drawn for, narrowest last. */
        for (const width of [profiles.narrow.viewport.width, 375, 340]) {
            test(`every link is a fingertip tall, on one band (${width}px)`, async ({
                page,
            }) => {
                await page.setViewportSize({ width, height: 800 });
                const links = page.locator(".navbar .nav-links a");
                for (const link of await links.all())
                    expect((await box(link)).height).toBeGreaterThanOrEqual(44);

                // One band: the logo, the links and the toggle side by side.
                expect(await page.evaluate(arrangement, PARTS)).toBe(
                    "side-by-side",
                );
            });

            /**
             * Measured with everything but the band taken off the page, so
             * that what is asserted is the band's own reach and nothing
             * else's.
             */
            test(`the band never lets the page scroll sideways (${width}px)`, async ({
                page,
            }) => {
                await page.setViewportSize({ width, height: 800 });
                const overflow = await page.evaluate(() => {
                    for (const other of document.querySelectorAll(
                        "body > :not(.sidebar)",
                    ))
                        other.remove();
                    return document.documentElement.scrollWidth - innerWidth;
                });
                expect(overflow).toBeLessThanOrEqual(0);
            });
        }

        test("the scheme toggle answers a fingertip all round it", async ({
            page,
        }) => {
            const icon = await box(page.locator(".theme-toggle .toggle-icon"));
            const [x, y] = [icon.x + icon.width / 2, icon.y + icon.height / 2];
            const reach = 20;
            const hits = await page.evaluate(
                (points) =>
                    points.map(
                        ([px, py]) =>
                            !!document
                                .elementFromPoint(px!, py!)
                                ?.closest(".theme-toggle"),
                    ),
                [
                    [x - reach, y],
                    [x, y - reach],
                    [x, y + reach],
                ],
            );
            expect(hits).toEqual([true, true, true]);
        });
    });

    section("Print", () => {
        onlyIn("print");

        test("it is not shown, and the content takes back the space", async ({
            page,
        }) => {
            await expect(page.locator(".navbar")).toBeHidden();

            const article = await box(page.locator("article"));
            expect(article.x).toBe(0);
        });
    });
});

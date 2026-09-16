import { expect, onlyIn, section, SPEC_PAGE, test } from "./_harness";

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

            // Compared by document position rather than child index: the
            // toggle is a Svelte island, so it arrives wrapped in an
            // <astro-island> that `display: contents` makes boxless.
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
    });

    section("Wide viewports", () => {
        onlyIn("wide", "nojs");

        test("it sits beside the content, arranged vertically", async ({
            page,
        }) => {
            const navbar = (await page.locator(".navbar").boundingBox())!;
            const article = (await page.locator("article").boundingBox())!;

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

    section("Narrow viewports", () => {
        onlyIn("narrow");

        test("it is horizontal, above the title, matching the measure", async ({
            page,
        }) => {
            const navbar = (await page.locator(".navbar").boundingBox())!;
            const title = (await page.locator(".title").boundingBox())!;
            const article = (await page.locator("article").boundingBox())!;

            expect(navbar.y + navbar.height).toBeLessThanOrEqual(title.y);
            expect(await page.evaluate(arrangement, PARTS)).toBe(
                "side-by-side",
            );
            expect(navbar.width).toBeCloseTo(article.width, 0);
        });
    });

    section("Print", () => {
        onlyIn("print");

        test("it is not shown, and the content takes back the space", async ({
            page,
        }) => {
            await expect(page.locator(".navbar")).toBeHidden();

            const article = (await page.locator("article").boundingBox())!;
            expect(article.x).toBe(0);
        });
    });
});

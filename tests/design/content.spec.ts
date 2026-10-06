import type { Page } from "@playwright/test";
import { expect, FIXTURE_PAGE, section, SPEC_PAGE, test } from "./_harness";

section("Content", () => {
    for (const path of [SPEC_PAGE, FIXTURE_PAGE]) {
        test(`the measure is at most 80 characters (${path})`, async ({
            page,
        }) => {
            await page.goto(path);

            // Measured in the font the page actually rendered with, rather than
            // trusting the `80ch` in the stylesheet to mean what it says.
            const { article, eighty } = await page.evaluate(() => {
                const body = getComputedStyle(document.body);
                const probe = document.createElement("span");
                probe.textContent = "0".repeat(80);
                probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${body.font}`;
                document.body.append(probe);
                const eighty = probe.getBoundingClientRect().width;
                probe.remove();
                return {
                    article: document
                        .querySelector("article")!
                        .getBoundingClientRect().width,
                    eighty,
                };
            });

            expect(article).toBeLessThanOrEqual(eighty + 1);
        });
    }

    section("Block elements", () => {
        test.beforeEach(async ({ page }) => {
            await page.goto(FIXTURE_PAGE);
        });

        /** What a pseudo-element of each match paints: its mask layers, its band and its ink. */
        const strokes = (page: Page, selector: string, pseudo: string) =>
            page.evaluate(
                ([selector, pseudo]) =>
                    [...document.querySelectorAll(selector)].map((el) => {
                        const style = getComputedStyle(el, pseudo);
                        return {
                            masks: [
                                ...style.maskImage.matchAll(
                                    /url\("?([^")]+)"?\)/g,
                                ),
                            ].map((match) => match[1]!),
                            height: parseFloat(style.height),
                            width: parseFloat(style.width),
                            ink: style.backgroundColor,
                        };
                    }),
                [selector, pseudo] as const,
            );

        const token = (page: Page, name: string) =>
            page.evaluate(
                (name) =>
                    getComputedStyle(document.documentElement).getPropertyValue(
                        `--color-${name}`,
                    ),
                name,
            );

        test("every table row is ruled off by a stroke in three pieces", async ({
            page,
        }) => {
            const head = await strokes(page, "article thead tr", "::after");
            const body = await strokes(page, "article tbody tr", "::after");
            expect(head.length).toBeGreaterThan(0);
            expect(body.length).toBeGreaterThan(1);

            for (const row of [...head, ...body])
                expect(row.masks).toHaveLength(3);
            for (const row of head) {
                expect(row.height).toBe(8);
                expect(row.ink).toBe(await token(page, "text"));
            }
            for (const row of body) {
                expect(row.height).toBe(4);
                expect(row.ink).toBe(await token(page, "border"));
            }
        });

        test("neighbouring body rows are ruled by different strokes", async ({
            page,
        }) => {
            const body = await strokes(page, "article tbody tr", "::after");
            for (let i = 1; i < body.length; i++)
                expect(body[i]!.masks).not.toEqual(body[i - 1]!.masks);
        });

        test("no cell draws a border of its own", async ({ page }) => {
            const bordered = await page.evaluate(
                () =>
                    [...document.querySelectorAll("article :is(th, td)")]
                        .map((cell) => getComputedStyle(cell))
                        .filter((style) =>
                            ["Top", "Right", "Bottom", "Left"].some(
                                (side) =>
                                    parseFloat(
                                        style.getPropertyValue(
                                            `border-${side.toLowerCase()}-width`,
                                        ),
                                    ) > 0,
                            ),
                        ).length,
            );
            expect(bordered).toBe(0);
        });

        test("a quotation hangs from a stroke of ink, and is at least two lines tall", async ({
            page,
        }) => {
            const quotes = await strokes(
                page,
                "article blockquote",
                "::before",
            );
            expect(quotes.length).toBeGreaterThan(0);
            for (const quote of quotes) {
                expect(quote.masks).toHaveLength(3);
                expect(quote.width).toBe(7);
                expect(quote.ink).toBe(await token(page, "text"));
            }

            const short = await page.evaluate(
                () =>
                    [...document.querySelectorAll("article blockquote")].filter(
                        (quote) =>
                            quote.getBoundingClientRect().height <
                            2 * parseFloat(getComputedStyle(quote).lineHeight),
                    ).length,
            );
            expect(short).toBe(0);
        });

        test("every stroke the page masks with is served", async ({
            page,
            profileName,
        }) => {
            test.skip(
                profileName !== "wide",
                "the same files in every profile",
            );

            const masks = [
                ...(await strokes(page, "article tr", "::after")),
                ...(await strokes(page, "article blockquote", "::before")),
                ...(await strokes(page, "small[role=note]", "::before")),
            ].flatMap((stroke) => stroke.masks);
            expect(masks.length).toBeGreaterThan(0);
            for (const url of new Set(masks)) {
                expect((await page.request.get(url)).status(), url).toBe(200);
            }
        });
    });
});

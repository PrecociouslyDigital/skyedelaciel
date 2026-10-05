import { expect, FIXTURE_PAGE, onlyIn, section, test } from "./_harness";

/** Where a section's collapse control sits relative to the link it controls. */
async function indicatorSide(
    page: import("@playwright/test").Page,
    toc: string,
) {
    return page.evaluate((selector) => {
        const item = [...document.querySelectorAll(`${selector} li`)].find(
            (li) => li.querySelector(":scope > details > summary"),
        );
        if (!item) return "no collapsible section";
        const link = item.querySelector(":scope > a")!.getBoundingClientRect();
        const summary = item
            .querySelector(":scope > details > summary")!
            .getBoundingClientRect();
        return summary.left < link.left ? "left" : "right";
    }, toc);
}

section("Table of contents", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(FIXTURE_PAGE);
    });

    section("Wide viewports", () => {
        onlyIn("wide", "nojs");

        test("it sits left of the content, under the navbar", async ({
            page,
        }) => {
            const toc = (await page.locator(".toc-sidebar").boundingBox())!;
            const navbar = (await page.locator(".navbar").boundingBox())!;
            const article = (await page.locator("article").boundingBox())!;

            expect(toc.x + toc.width).toBeLessThanOrEqual(article.x);
            expect(toc.y).toBeGreaterThanOrEqual(navbar.y + navbar.height);
        });

        test("it sticks to the top of the viewport as you scroll", async ({
            page,
        }) => {
            // What sticking looks like, rather than `position: sticky` — the
            // declaration is no evidence on its own, since an ancestor with
            // the wrong overflow silently turns it back into static.
            const toc = page.locator(".toc-sidebar");
            const scroll = 1200;

            const before = (await toc.boundingBox())!;
            await page.evaluate((by) => window.scrollBy(0, by), scroll);
            const after = (await toc.boundingBox())!;

            // It moved up by less than the page scrolled, and stayed on screen.
            expect(after.y).toBeGreaterThanOrEqual(0);
            expect(before.y - after.y).toBeLessThan(scroll);
        });

        test("siblings are grouped by a line on their left", async ({
            page,
        }) => {
            const nested = page.locator(".toc-sidebar .toc-list .toc-list");
            await expect(nested).not.toHaveCount(0);
            const border = await nested
                .first()
                .evaluate((el) => getComputedStyle(el).borderLeftWidth);
            expect(parseFloat(border)).toBeGreaterThan(0);
        });

        test("the collapse indicator is to the right of its section", async ({
            page,
        }) => {
            expect(await indicatorSide(page, ".toc-sidebar")).toBe("right");
        });

        test.describe("as the reader scrolls", () => {
            onlyIn("wide");

            const current = (page: import("@playwright/test").Page) =>
                page
                    .locator(".toc-sidebar a[data-current]")
                    .getAttribute("href");

            /**
             * Put the reading line `offset` pixels below where the heading
             * behind the `index`th entry begins.
             */
            const readAt = (
                page: import("@playwright/test").Page,
                index: number,
                offset: number,
            ) =>
                page.evaluate(
                    ([index, offset]) => {
                        const href = document
                            .querySelectorAll(".toc-sidebar a[href^='#']")
                            [index]!.getAttribute("href")!;
                        const top = document
                            .getElementById(href.slice(1))!
                            .getBoundingClientRect().top;
                        scrollTo(
                            0,
                            scrollY + top - innerHeight * 0.05 + offset,
                        );
                        return href;
                    },
                    [index, offset] as const,
                );

            /**
             * Scrolling back up past where a section begins returns the reader
             * to the section before it — the one they are now in — rather than
             * leaving the later one current until the earlier one's top is
             * reached again.
             */
            test("the current entry is the section being read, either way", async ({
                page,
            }) => {
                const entry = await readAt(page, 2, 10);
                await expect.poll(() => current(page)).toBe(entry);

                const before = await readAt(page, 1, 0);
                await readAt(page, 2, -10);
                await expect.poll(() => current(page)).toBe(before);
            });

            test("the box holds the entry and what it unfolded", async ({
                page,
            }) => {
                await readAt(page, 0, 10);
                const entry = page.locator(".toc-sidebar a[data-current]");
                await expect(entry).toHaveCount(1);

                await expect
                    .poll(() =>
                        entry.evaluate((link) => {
                            const item = link.parentElement!;
                            const box = getComputedStyle(
                                link.closest(".toc-root")!,
                                "::before",
                            );
                            return (
                                Math.round(parseFloat(box.height)) ===
                                Math.round(item.getBoundingClientRect().height)
                            );
                        }),
                    )
                    .toBe(true);
            });
        });
    });

    section("Narrow viewports", () => {
        onlyIn("narrow");

        test("it is in line with the content, after the abstract", async ({
            page,
        }) => {
            const toc = page.locator(".toc-portrait");
            await expect(toc).toBeVisible();

            const abstractFirst = await page.evaluate(
                () =>
                    document
                        .querySelector(".abstract")!
                        .compareDocumentPosition(
                            document.querySelector(".toc-portrait")!,
                        ) & Node.DOCUMENT_POSITION_FOLLOWING,
            );
            expect(abstractFirst).toBeTruthy();
        });

        test("everything is collapsed by default", async ({ page }) => {
            const list = page.locator(".toc-portrait > .toc-list");
            expect((await list.boundingBox())?.height ?? 0).toBe(0);
            await expect(
                page.locator(".toc-portrait details[open]"),
            ).toHaveCount(0);
        });

        test("the collapse indicator is to the left of its section", async ({
            page,
        }) => {
            await page.locator('.toc-portrait label[for="toc-toggle"]').click();
            expect(await indicatorSide(page, ".toc-portrait")).toBe("left");
        });

        test("it does not auto-expand as you scroll", async ({ page }) => {
            await page.locator('.toc-portrait label[for="toc-toggle"]').click();
            await page.evaluate(() => window.scrollBy(0, 2000));
            await expect(
                page.locator(".toc-portrait details[open]"),
            ).toHaveCount(0);
        });
    });

    section("Print", () => {
        onlyIn("print");

        test("it is in line with the content and fully expanded", async ({
            page,
        }) => {
            const toc = page.locator(".toc-portrait");
            await expect(toc).toBeVisible();

            const hidden = await page.evaluate(() => {
                const links = [...document.querySelectorAll(".toc-portrait a")];
                return links
                    .filter((a) => a.getBoundingClientRect().height === 0)
                    .map((a) => a.textContent);
            });
            expect(hidden).toEqual([]);
        });
    });
});

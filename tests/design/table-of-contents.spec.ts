import { profiles } from "../../tools/browser/profiles.mjs";
import type { Page } from "@playwright/test";
import { box, expect, FIXTURE_PAGE, onlyIn, section, test } from "./_harness";

/** Where a section's collapse control sits relative to the link it controls. */
async function indicatorSide(page: Page, toc: string) {
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

/**
 * Unfold a top-level section of the sidebar by its own disclosure, as a
 * reader would, and wait for it to finish growing.
 */
async function openSection(page: Page, href: string) {
    const details = page.locator(`.toc-sidebar a[href="${href}"] ~ details`);
    if (!(await details.evaluate((d: HTMLDetailsElement) => d.open)))
        await details.locator("summary").click();
    // Polled from here rather than with `waitForFunction`, which needs the
    // page's own scripting, and the nojs profile has none.
    await expect
        .poll(() =>
            details.evaluate((d) =>
                d
                    .getAnimations({ subtree: true })
                    .every((a) => a.playState !== "running"),
            ),
        )
        .toBe(true);
}

/**
 * Where the ::before of what `selector` names is across the screen, and what
 * it paints, from its computed offsets: a pseudo-element has no box of its own
 * to ask for.
 */
const drawing = (page: Page, selector: string) =>
    page.evaluate((selector) => {
        const element = document.querySelector(selector)!;
        const style = getComputedStyle(element, "::before");
        const left =
            element.getBoundingClientRect().left + parseFloat(style.left);
        return {
            image: style.backgroundImage,
            left,
            right: left + parseFloat(style.width),
            height: parseFloat(style.height),
        };
    }, selector);

/** The right edge of the furthest words among the links `selector` names. */
const wordsEnd = (page: Page, selector: string) =>
    page.evaluate(
        (selector) =>
            Math.max(
                ...[...document.querySelectorAll(selector)].map((link) => {
                    const range = document.createRange();
                    range.selectNodeContents(link);
                    return range.getBoundingClientRect().right;
                }),
            ),
        selector,
    );

section("Table of contents", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(FIXTURE_PAGE);
    });

    section("Wide viewports", () => {
        onlyIn("wide", "nojs");

        test("it sits left of the content, under the navbar", async ({
            page,
        }) => {
            const toc = await box(page.locator(".toc-sidebar"));
            const navbar = await box(page.locator(".navbar"));
            const article = await box(page.locator("article"));

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

            const before = await box(toc);
            await page.evaluate((by) => window.scrollBy(0, by), scroll);
            const after = await box(toc);

            // It moved up by less than the page scrolled, and stayed on screen.
            expect(after.y).toBeGreaterThanOrEqual(0);
            expect(before.y - after.y).toBeLessThan(scroll);
        });

        /**
         * Grouping is drawn, not ruled: a section's entries share the vine it
         * grows when it unfolds, in the column on the disclosure's side.
         */
        test("a section's entries are grouped by a vine on the disclosure side", async ({
            page,
        }) => {
            await openSection(page, "#links");
            const section = '.toc-sidebar a[href="#links"] ~ details ol';
            const vine = await drawing(page, section);

            expect(vine.image).toMatch(/^url\(/);
            expect(vine.height).toBeGreaterThan(0);
            expect((vine.left + vine.right) / 2).toBeGreaterThan(
                await wordsEnd(page, `${section} a`),
            );
        });

        test("only the top level folds", async ({ page }) => {
            const folds = await page.evaluate(() =>
                [...document.querySelectorAll(".toc-sidebar details")].map(
                    (details) =>
                        details.parentElement!.matches('li[data-depth="1"]'),
                ),
            );
            expect(folds).not.toHaveLength(0);
            expect(folds).not.toContain(false);

            // Below it, an entry's section is shown as soon as it is.
            await openSection(page, "#heading-1");
            await expect(
                page.locator('.toc-sidebar a[href="#heading-3"]'),
            ).toBeVisible();
        });

        test("the first level is set heavier than the second", async ({
            page,
        }) => {
            await openSection(page, "#heading-1");
            const weights = (depth: number) =>
                page.$$eval(
                    `.toc-sidebar li[data-depth="${depth}"] > a`,
                    (links) =>
                        links.map((link) =>
                            Number(getComputedStyle(link).fontWeight),
                        ),
                );

            expect(Math.min(...(await weights(1)))).toBeGreaterThan(
                Math.max(...(await weights(2))),
            );
        });

        /**
         * A third-level entry is reached by a shoot off its section's vine,
         * which spans the gap from the vine's column toward the entry's words
         * without reaching them.
         */
        test("a third-level entry has a shoot from the vine to its words", async ({
            page,
        }) => {
            await openSection(page, "#heading-1");
            const link = 'a[href="#heading-3"]';
            const shoot = await drawing(page, `.toc-sidebar li:has(> ${link})`);
            const list = await box(page.locator(".toc-sidebar .toc-root"));

            expect(shoot.image).toMatch(/^url\(/);
            expect(shoot.left).toBeGreaterThan(
                await wordsEnd(page, `.toc-sidebar ${link}`),
            );
            // It leaves from the vine, in the column at the list's edge.
            expect(shoot.right).toBeGreaterThan(list.x + list.width - 16);
        });

        test("the collapse indicator is to the right of its section", async ({
            page,
        }) => {
            expect(await indicatorSide(page, ".toc-sidebar")).toBe("right");
        });

        test.describe("as the reader scrolls", () => {
            onlyIn("wide");

            const current = (page: Page) =>
                page
                    .locator(".toc-sidebar a[data-current]")
                    .getAttribute("href");

            /**
             * Put the reading line `offset` pixels below where the heading
             * behind the `index`th entry begins.
             */
            const readAt = (page: Page, index: number, offset: number) =>
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

            /** Where the box's sides are, against the list's own edge. */
            const tracker = (page: Page) =>
                page
                    .locator(".toc-sidebar a[data-current]")
                    .evaluate((link) => {
                        const list = link.closest<HTMLElement>(".toc-root")!;
                        const range = document.createRange();
                        range.selectNodeContents(link);
                        const read = (name: string) =>
                            parseFloat(list.style.getPropertyValue(name));
                        const edge = list.getBoundingClientRect();
                        const left = edge.left + read("--toc-tracker-left");
                        const words = range.getBoundingClientRect();
                        return {
                            left,
                            right: left + read("--toc-tracker-width"),
                            edge: edge.right,
                            words: { left: words.left, right: words.right },
                        };
                    });

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

            /**
             * A whole section is boxed out past the vine it grows on, so that
             * the ticks never land on it; a single entry hugs its words and
             * stops short of the vine and its marks.
             */
            test("a section's box reaches past its vine, a single entry's does not", async ({
                page,
            }) => {
                await readAt(page, 0, 10);
                await expect
                    .poll(async () => {
                        const { right, edge } = await tracker(page);
                        return right > edge;
                    })
                    .toBe(true);

                await readAt(page, 2, 10);
                await expect
                    .poll(async () => {
                        const { left, right, edge, words } =
                            await tracker(page);
                        return (
                            left < words.left &&
                            right > words.right &&
                            right < edge
                        );
                    })
                    .toBe(true);
            });

            /**
             * In a window too short for them, the contents scroll on their
             * own, the navbar staying where it is, and bring the entry being
             * read into view.
             */
            test("the contents scroll on their own in a short window", async ({
                page,
            }) => {
                await page.setViewportSize({
                    width: profiles.wide.viewport.width,
                    height: 450,
                });
                const navbar = await box(page.locator(".navbar"));
                await readAt(page, 13, 10);

                await expect
                    .poll(() =>
                        page.evaluate(() => {
                            const toc = document.querySelector(".toc-sidebar")!;
                            const view = toc.getBoundingClientRect();
                            const current = toc
                                .querySelector("a[data-current]")
                                ?.getBoundingClientRect();
                            return (
                                toc.scrollTop > 0 &&
                                current !== undefined &&
                                current.top >= view.top &&
                                current.bottom <= view.bottom
                            );
                        }),
                    )
                    .toBe(true);
                const after = await box(page.locator(".navbar"));
                expect(after.y).toBeCloseTo(navbar.y, 0);
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

        test("it carries no ornament", async ({ page }) => {
            const drawn = await page.evaluate(() =>
                [...document.querySelectorAll(".toc-portrait *")].flatMap(
                    (element) =>
                        ["::before", "::after"]
                            .map((pseudo) => getComputedStyle(element, pseudo))
                            .filter(
                                (style) =>
                                    style.display !== "none" &&
                                    style.backgroundImage.startsWith("url("),
                            )
                            .map(() => element.tagName),
                ),
            );
            expect(drawn).toEqual([]);
        });
    });
});

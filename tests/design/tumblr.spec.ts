import {
    expect,
    onlyIn,
    section,
    test,
    TUMBLR_INDEX,
    TUMBLR_POST,
    WIDE,
} from "./_harness";
import type { Page } from "@playwright/test";

/** The text colour the page resolved, to compare an entry's ink against. */
const ink = (page: Page) =>
    page.evaluate(() =>
        getComputedStyle(document.documentElement)
            .getPropertyValue("--color-text")
            .trim(),
    );

/** Scroll until the reading line sits a little way into `selector`. */
const readInto = (page: Page, selector: string) =>
    page.evaluate((target) => {
        const top = document.querySelector(target)!.getBoundingClientRect().top;
        scrollTo(0, scrollY + top - innerHeight * 0.05 + 20);
    }, selector);

section("Tumblr", () => {
    test.describe("an index page", () => {
        test.beforeEach(async ({ page }) => {
            await page.goto(TUMBLR_INDEX);
        });

        test.describe("on screen", () => {
            onlyIn("wide", "narrow", "nojs");

            test("it is a part of the site, and the navbar says which", async ({
                page,
            }) => {
                const current = page.locator(
                    '.nav-links a[aria-current="page"]',
                );
                await expect(current).toHaveCount(1);
                await expect(current).toHaveText("Tumblr");
                expect(
                    await current.evaluate((a) => getComputedStyle(a).color),
                ).toBe(await ink(page));

                // Everything else names the site, since this page is not on it.
                const hrefs = await page
                    .locator(".navbar a:not([aria-current])")
                    .evaluateAll((links) =>
                        links.map((a) => a.getAttribute("href")),
                    );
                expect(
                    hrefs.filter((href) => !/^https:\/\//.test(href!)),
                ).toEqual([]);
            });
        });

        test("sets each post as an article, stamped with its figures", async ({
            page,
        }) => {
            const rails = await page
                .locator("main article.post")
                .evaluateAll((posts) =>
                    posts.map((post) => (post as HTMLElement).dataset.rail),
                );

            expect(rails.length).toBeGreaterThan(1);
            for (const rail of rails)
                expect(rail).toMatch(/^\d{4}-\d{2}-\d{2}( · \d+ notes?)?$/);
        });

        test.describe("beside a sidebar", () => {
            onlyIn(...WIDE);

            test("the contents list the posts, with their tags under them", async ({
                page,
            }) => {
                const entries = page.locator(".toc-sidebar .toc-root > li > a");
                const posts = page.locator("main article.post");
                expect(await entries.count()).toBe(await posts.count());

                const tags = page.locator(
                    ".toc-sidebar .toc-root > li .toc-list a",
                );
                await expect(tags.first()).toHaveText(/^#/);
            });

            test("and the tags are not repeated at the foot of a post", async ({
                page,
            }) => {
                await expect(page.locator(".post-tags").first()).toBeHidden();
            });
        });

        test.describe("as the reader scrolls", () => {
            onlyIn("wide");

            test("the post being read unfolds its tags, and only it", async ({
                page,
            }) => {
                await readInto(page, "#post-101");
                await expect(
                    page.locator(".toc-sidebar a[data-current]"),
                ).toHaveAttribute("href", "#post-101");
            });

            /**
             * The last post is short, and the page ends before its top can
             * reach the reading line; it is current all the same once the
             * page is read to the end.
             */
            test("the last post is current at the end of the page", async ({
                page,
            }) => {
                await page.evaluate(() =>
                    scrollTo(0, document.documentElement.scrollHeight),
                );

                await expect(
                    page.locator(".toc-sidebar a[data-current]"),
                ).toHaveAttribute("href", "#post-103");
                const open = page.locator(".toc-sidebar details[open]");
                await expect(open).toHaveCount(1);
                await expect(open.locator("a")).toHaveText(["#quotes"]);
            });

            test("a post with no tags shows no chevron", async ({ page }) => {
                await expect(
                    page.locator(
                        '.toc-sidebar a[href="#post-102"] + details > summary',
                    ),
                ).toBeHidden();
            });
        });

        test.describe("without a sidebar", () => {
            onlyIn("narrow");

            test("tags close each post", async ({ page }) => {
                await expect(page.locator(".post-tags").first()).toBeVisible();
            });
        });
    });

    test.describe("a post's own page", () => {
        test.beforeEach(async ({ page }) => {
            await page.goto(TUMBLR_POST);
        });

        test("closes with its notes", async ({ page }) => {
            const notes = page.locator("article #notes");
            await expect(notes).toHaveClass(/closing/);
            await expect(notes.locator("li")).not.toHaveCount(0);
        });

        test.describe("beside a sidebar", () => {
            onlyIn(...WIDE);

            test("its tags are the contents", async ({ page }) => {
                await expect(
                    page.locator(".toc-sidebar .toc-root > li > a"),
                ).toHaveText(["#calligraphy", "#tools"]);
            });
        });
    });
});

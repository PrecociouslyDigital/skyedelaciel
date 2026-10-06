import { expect, onlyIn, section, SHELF, test } from "./_harness";

const { scheduled } = SHELF;

section("Publication", () => {
    test("a scheduled article reads under the prefix as it will once out", async ({
        page,
    }) => {
        await page.goto(scheduled.preview);
        await expect(page.locator(".front-matter .title")).toHaveText(
            scheduled.title,
        );
        await expect(page.locator("article")).toHaveAttribute(
            "data-rail",
            /^9999-12-31/,
        );
    });

    test("its own address is not found", async ({ page }) => {
        const response = await page.goto(scheduled.path);
        expect(response?.status()).toBe(404);
    });

    section("Nothing else knows it is there", () => {
        // Reads what the build wrote rather than how it lays out, so one
        // profile says it all.
        onlyIn("wide");

        test("not the feed", async ({ request }) => {
            const feed = await (await request.get("/rss.xml")).text();
            expect(feed).toContain("Unlinked Piece");
            expect(feed).not.toContain(scheduled.title);
            expect(feed).not.toContain(scheduled.path);
        });

        test("not the sitemap", async ({ request }) => {
            const sitemap = await (await request.get("/sitemap-0.xml")).text();
            expect(sitemap).toContain(SHELF.unlinked);
            expect(sitemap).not.toContain(scheduled.path);
        });

        /* Every page the sitemap lists, and the one it cannot: whatever lists
           pieces, and whatever carries a popover, is among them. */
        test("not any page", async ({ request }) => {
            const sitemap = await (await request.get("/sitemap-0.xml")).text();
            const paths = [
                ...[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
                    ([, loc]) => new URL(loc!).pathname,
                ),
                "/404.html",
            ];
            expect(paths).toContain(SHELF.page);
            for (const path of paths) {
                const html = await (await request.get(path)).text();
                expect(html, path).not.toContain(scheduled.title);
                expect(html, path).not.toContain(scheduled.path);
            }
        });
    });
});

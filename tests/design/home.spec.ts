import { SITE_NAME } from "../../src/site";
import { box, expect, onlyIn, section, SHELF, test } from "./_harness";

section("Home", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
    });

    test("opens with the site's name and an introduction", async ({ page }) => {
        await expect(page.locator(".front-matter .title")).toHaveText(
            SITE_NAME,
        );
        await expect(page.locator(".front-matter .abstract")).not.toBeEmpty();
    });

    test("lists the latest pieces, newest first", async ({ page }) => {
        const pieces = page.locator(".pieces li");
        await expect(pieces.locator(".piece-title")).toHaveText([
            "Unlinked Piece",
            "Linked Piece",
        ]);
        const days = await pieces
            .locator("time")
            .evaluateAll((times) =>
                times.map((time) => time.getAttribute("datetime")!),
            );
        expect(days).toEqual(days.toSorted().reverse());
        await expect(pieces.first().locator(".piece-title")).toHaveAttribute(
            "href",
            SHELF.unlinked,
        );
        await expect(pieces.first().locator(".piece-abstract")).not.toBeEmpty();
    });

    test("has no table of contents", async ({ page }) => {
        await expect(page.locator(".toc .toc-list")).toHaveCount(0);
    });

    section("Wide viewports", () => {
        onlyIn("wide", "nojs");

        test("a piece's date sits beside its title", async ({ page }) => {
            const piece = page.locator(".pieces li").first();
            const title = await box(piece.locator(".piece-title"));
            const date = await box(piece.locator("time"));
            expect(date.x).toBeGreaterThan(title.x + title.width);
            expect(date.y).toBeLessThan(title.y + title.height);
        });
    });
});

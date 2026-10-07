import { expect, section, test } from "./_harness";

section("Home", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
    });

    test("has no table of contents", async ({ page }) => {
        await expect(page.locator(".toc .toc-list")).toHaveCount(0);
    });
});

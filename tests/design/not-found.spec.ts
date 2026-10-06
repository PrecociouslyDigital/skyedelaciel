import { expect, onlyIn, section, test } from "./_harness";

section("Not found", () => {
    test.beforeEach(async ({ page }) => {
        const response = await page.goto("/no-such-page/");
        expect(response?.status()).toBe(404);
    });

    test("says there is no page, and links home and to each section", async ({
        page,
    }) => {
        await expect(page.locator(".front-matter .title")).toHaveText(
            "Not found",
        );
        for (const href of ["/", "/fiction/", "/nonfiction/"]) {
            await expect(page.locator(`article a[href="${href}"]`)).toHaveCount(
                1,
            );
        }
    });

    section("Navbar", () => {
        onlyIn("wide", "narrow", "nojs");

        test("is set in the same shell", async ({ page }) => {
            await expect(page.locator(".navbar")).toBeVisible();
        });
    });
});

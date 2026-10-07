import { expect, onlyIn, section, test } from "./_harness";

section("Not found", () => {
    test.beforeEach(async ({ page }) => {
        const response = await page.goto("/no-such-page/");
        expect(response?.status()).toBe(404);
    });

    section("Navbar", () => {
        onlyIn("wide", "narrow", "nojs");

        test("is set in the same shell", async ({ page }) => {
            await expect(page.locator(".navbar")).toBeVisible();
        });
    });
});

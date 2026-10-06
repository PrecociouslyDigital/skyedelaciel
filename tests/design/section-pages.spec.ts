import { expect, onlyIn, section, SHELF, test } from "./_harness";

const EVERYTHING_ELSE = ".everything-else";

section("Section pages", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(SHELF.page);
    });

    test("opens with its title and abstract, and no byline or stamp", async ({
        page,
    }) => {
        await expect(page.locator(".front-matter .title")).toHaveText("Shelf");
        await expect(page.locator(".front-matter .abstract")).not.toBeEmpty();
        await expect(page.locator(".front-matter .author")).toHaveCount(0);
        await expect(page.locator("article")).not.toHaveAttribute("data-rail");
    });

    test("its links get their popovers", async ({ page }) => {
        const wrapper = page.locator(".link-wrapper", {
            has: page.locator(`a[href="${SHELF.linked}"]`),
        });
        await expect(wrapper.locator(".link-popover-title")).toHaveText(
            "Linked Piece",
        );
    });

    test("Everything Else lists what the page does not link to", async ({
        page,
    }) => {
        const listed = page.locator(`${EVERYTHING_ELSE} .piece-title`);
        await expect(listed).toHaveText(["Unlinked Piece"]);
        await expect(listed).toHaveAttribute("href", SHELF.unlinked);
    });

    test("Everything Else is a heading with an entry in the contents", async ({
        page,
    }) => {
        const heading = page.locator(`${EVERYTHING_ELSE} h2`);
        await expect(heading).toHaveText(/Everything Else/);
        await expect(heading.locator("a")).toHaveAttribute(
            "href",
            "#everything-else",
        );
        await expect(
            page.locator('.toc a[href="#everything-else"]').first(),
        ).toBeAttached();
    });

    test("with nothing left over, Everything Else is left out", async ({
        page,
    }) => {
        // The real sections have no published pieces yet.
        await page.goto("/fiction/");
        await expect(page.locator(".front-matter .title")).toHaveText(
            "Fiction",
        );
        await expect(page.locator(EVERYTHING_ELSE)).toHaveCount(0);
        await expect(
            page.locator('.toc a[href="#everything-else"]'),
        ).toHaveCount(0);
    });

    section("Navbar", () => {
        onlyIn("wide", "narrow", "nojs");

        test("marks the section the reader is in", async ({ page }) => {
            await page.goto("/fiction/");
            await expect(
                page.locator('.navbar a[aria-current="page"]'),
            ).toHaveText("Fiction");
        });
    });
});

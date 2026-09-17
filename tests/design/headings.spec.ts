import {
    CONTENT_HEADINGS,
    expect,
    FIXTURE_PAGE,
    onlyIn,
    section,
    test,
} from "./_harness";

section("Headings", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(FIXTURE_PAGE);
    });

    test("they are set in a different font from the prose", async ({
        page,
    }) => {
        const { body, headings } = await page.evaluate(
            (selector) => ({
                body: getComputedStyle(document.body).fontFamily,
                headings: [...document.querySelectorAll(selector)].map(
                    (h) => getComputedStyle(h).fontFamily,
                ),
            }),
            CONTENT_HEADINGS,
        );

        expect(headings.length).toBeGreaterThan(0);
        for (const font of headings) expect(font).not.toBe(body);
    });

    test("every heading is an anchor link to itself", async ({ page }) => {
        const mismatches = await page.evaluate(
            (selector) =>
                [...document.querySelectorAll(selector)]
                    .map((heading) => ({
                        id: heading.id,
                        href: heading
                            .querySelector("a.heading-anchor")
                            ?.getAttribute("href"),
                    }))
                    .filter(({ id, href }) => href !== `#${id}`),
            CONTENT_HEADINGS,
        );
        expect(mismatches).toEqual([]);
    });

    section("Wide viewports", () => {
        onlyIn("wide", "narrow");

        test("hovering reveals an icon that copies the anchor", async ({
            page,
            context,
        }) => {
            await context.grantPermissions([
                "clipboard-read",
                "clipboard-write",
            ]);

            const heading = page.locator("article > h1").first();
            const icon = heading.locator(".copy-anchor");
            await expect(icon).toBeAttached();

            // Revealed on hover, rather than added: it is there all along, and
            // hovering only makes it more visible than it was.
            const opacity = () =>
                icon.evaluate((el) => parseFloat(getComputedStyle(el).opacity));
            const resting = await opacity();
            expect(resting, "invisible until hovered").toBe(0);

            await heading.hover();
            await expect.poll(opacity).toBeGreaterThan(resting);

            await icon.click();
            const copied = await page.evaluate(() =>
                navigator.clipboard.readText(),
            );
            const id = await heading.getAttribute("id");
            expect(copied).toBe(`${page.url().split("#")[0]}#${id}`);
        });
    });

    section("Print", () => {
        onlyIn("print");

        test("the copy icon is not printed", async ({ page }) => {
            // Hidden, not absent: an empty result would otherwise mean either.
            await expect(page.locator(".copy-anchor")).not.toHaveCount(0);

            const printed = await page.evaluate(() =>
                [...document.querySelectorAll(".copy-anchor")]
                    .filter((el) => el.checkVisibility())
                    .map((el) => el.closest("[id]")?.id ?? "(no heading)"),
            );
            expect(printed, "copy icons still on the page").toEqual([]);
        });
    });
});

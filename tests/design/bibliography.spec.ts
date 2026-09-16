import {
    expect,
    FIXTURE_PAGE,
    PROSE_LINKS,
    section,
    SPEC_PAGE,
    test,
} from "./_harness";

section("Bibliography", () => {
    test("no `bibliography: true`, no Works Referenced section", async ({
        page,
    }) => {
        await page.goto(SPEC_PAGE);
        await expect(page.locator(".bibliography")).toHaveCount(0);
    });

    test("with it, every outbound link earns an entry", async ({ page }) => {
        await page.goto(FIXTURE_PAGE);
        const bibliography = page.locator(".bibliography");
        await expect(bibliography).toBeVisible();
        await expect(
            bibliography.getByRole("heading", { name: "Works Referenced" }),
        ).toBeVisible();

        await expect(page.locator(PROSE_LINKS)).not.toHaveCount(0);

        const missing = await page.evaluate((selector) => {
            const referenced = new Set(
                [...document.querySelectorAll(".bibliography li a")].map((a) =>
                    a.getAttribute("href"),
                ),
            );
            return (
                [...document.querySelectorAll(selector)]
                    .map((a) => a.getAttribute("href") ?? "")
                    // Internal links are not works; they are this site.
                    .filter((href) => /^https?:/.test(href))
                    .filter((href) => !referenced.has(href))
            );
        }, PROSE_LINKS);
        expect(missing, "links in the prose with no entry").toEqual([]);
    });

    /**
     * How the entries read is `formatCitation`'s business, and
     * tests/unit/links.test.ts pins it against the MLA style there. What this
     * page can add is the claim the spec makes about the markup: "entries
     * should be links to their source" — so a work with no source to point at
     * has to render as text, not as an anchor that goes nowhere.
     */
    test("entries link to their source, and only where there is one", async ({
        page,
    }) => {
        await page.goto(FIXTURE_PAGE);
        await expect(page.locator(".bibliography li")).not.toHaveCount(0);

        const hrefless = await page.evaluate(() =>
            [...document.querySelectorAll(".bibliography li a")]
                .filter((a) => !a.getAttribute("href"))
                .map((a) => a.textContent?.slice(0, 60)),
        );
        expect(hrefless, "entries rendered as links to nowhere").toEqual([]);
    });

    test("frontmatter citations join the links", async ({ page }) => {
        await page.goto(FIXTURE_PAGE);
        // `citation:` in the fixture's frontmatter, which is not a link anywhere
        // in its body — so it can only have come from that list.
        await expect(page.locator(".bibliography")).toContainText(
            "Visual Display of Quantitative Information",
        );
    });

    section("Print", () => {
        test("the URL is shown on paper and hidden on screen", async ({
            page,
            profileName,
        }) => {
            await page.goto(FIXTURE_PAGE);
            const url = page.locator(".bibliography .cite-url").first();
            await expect(url).toBeAttached();

            expect(await url.evaluate((el) => el.checkVisibility())).toBe(
                profileName === "print",
            );
        });
    });
});

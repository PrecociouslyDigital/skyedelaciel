import {
    expect,
    FIXTURE_PAGE,
    onlyIn,
    PROSE_LINKS,
    section,
    test,
} from "./_harness";

/**
 * What each kind of popover may carry, counted rather than quoted.
 *
 * The strings themselves — the site name, a publication, a formatted date —
 * belong to the resolvers, and tests/unit/links.test.ts pins them there. What
 * this page can add is that the *shape* survives rendering: the spec allows
 * internal pages a site name "but not any other information", allows Wikipedia
 * "the title, summary and infobox" and no author line, and allows DOIs and
 * external pages the full author/publication/date apparatus.
 */
const STYLES = {
    "Default Style": {
        href: "https://example.com/fixture-article",
        meta: { min: 1, max: 3 },
    },
    "Internal Pages": { href: "/design", meta: { min: 1, max: 1 } },
    DOIs: {
        href: "https://doi.org/10.0000/fixture.doi.2026",
        meta: { min: 1, max: 3 },
    },
    Wikipedia: {
        href: "https://en.wikipedia.org/wiki/Fixture_article",
        meta: { min: 0, max: 0 },
    },
} as const;

section("Links", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(FIXTURE_PAGE);
    });

    test("they are semi-bold, in body colour, and not underlined", async ({
        page,
    }) => {
        await expect(page.locator(PROSE_LINKS)).not.toHaveCount(0);

        const offenders = await page.evaluate((selector) => {
            const bodyColour = getComputedStyle(document.body).color;
            return [...document.querySelectorAll(selector)]
                .map((link) => {
                    const style = getComputedStyle(link);
                    return {
                        href: link.getAttribute("href"),
                        weight: Number(style.fontWeight),
                        colour: style.color,
                        decoration: style.textDecorationLine,
                        bodyColour,
                    };
                })
                .filter(
                    (link) =>
                        link.weight < 600 ||
                        link.colour !== link.bodyColour ||
                        link.decoration !== "none",
                );
        }, PROSE_LINKS);
        expect(offenders).toEqual([]);
    });

    section("Popover", () => {
        onlyIn("wide", "narrow");

        test("it appears above the link on hover, capped and scrollable", async ({
            page,
        }) => {
            const wrapper = page.locator(".link-wrapper").first();
            const popover = wrapper.locator(".link-popover");

            await expect(popover).toBeHidden();
            await wrapper.locator("a").hover();
            await expect(popover).toBeVisible();

            const link = (await wrapper.locator("a").boundingBox())!;
            const box = (await popover.boundingBox())!;
            expect(box.y + box.height).toBeLessThanOrEqual(link.y + 1);

            // "A fixed maximum size, and can be scrolled if its contents are
            // long" — so the cap has to actually bind the rendered box, and
            // the overflow it creates has to be reachable.
            const { cap, height, overflowY } = await popover.evaluate((el) => {
                const computed = getComputedStyle(el);
                return {
                    cap: parseFloat(computed.maxHeight),
                    height: el.getBoundingClientRect().height,
                    overflowY: computed.overflowY,
                };
            });
            expect(cap).toBeGreaterThan(0);
            expect(height).toBeLessThanOrEqual(cap + 1);
            expect(["scroll", "auto"]).toContain(overflowY);
        });

        test("the pointer can travel from the link into the popover", async ({
            page,
        }) => {
            // Scrolling a popover means reaching it first, so the standoff it
            // keeps from its link has to be ground the pointer can stand on.
            // Crossing it here is deliberately slow: the popover is given
            // longer than its own fade to close, and has to still be there.
            const FADE_OUT = 1000;

            const wrapper = page
                .locator(".link-wrapper")
                .filter({ hasText: "ordinary external link" })
                .first();
            await wrapper.locator("a").hover();

            const popover = wrapper.locator(".link-popover");
            await expect(popover).toBeVisible();

            const link = (await wrapper.locator("a").boundingBox())!;
            const box = (await popover.boundingBox())!;

            await page.mouse.move(
                link.x + link.width / 2,
                (box.y + box.height + link.y) / 2,
            );
            await page.waitForTimeout(FADE_OUT);
            await expect(popover).toBeVisible();

            await page.mouse.move(
                box.x + box.width / 2,
                box.y + box.height / 2,
            );
            await page.waitForTimeout(FADE_OUT);
            await expect(popover).toBeVisible();
        });

        test("every popover is the same width, however long its contents", async ({
            page,
        }) => {
            // The other half of "a fixed maximum size": a popover is not
            // allowed to grow sideways to fit what it was given.
            const widths = new Set<number>();
            for (const { href } of Object.values(STYLES)) {
                const wrapper = page
                    .locator(".link-wrapper")
                    .filter({ has: page.locator(`a[href="${href}"]`) })
                    .first();
                await wrapper.locator("a").hover();
                const popover = wrapper.locator(".link-popover");
                await expect(popover).toBeVisible();
                widths.add((await popover.boundingBox())!.width);
            }
            expect([...widths]).toHaveLength(1);
        });

        test("title first, metadata second, then the body", async ({
            page,
        }) => {
            const wrapper = page
                .locator(".link-wrapper")
                .filter({ hasText: "ordinary external link" })
                .first();
            await wrapper.locator("a").hover();

            const order = await wrapper
                .locator(".link-popover")
                .evaluate((el) =>
                    [...el.children].map((child) =>
                        child.className.replace("link-popover-", ""),
                    ),
                );
            expect(order.slice(0, 3)).toEqual(["title", "meta", "description"]);

            expect(
                await wrapper
                    .locator(".link-popover-meta")
                    .evaluate((el) => getComputedStyle(el).fontStyle),
            ).toBe("italic");
        });

        for (const [heading, { href, meta }] of Object.entries(STYLES)) {
            test(`${heading}: the popover carries what that kind of link knows`, async ({
                page,
            }) => {
                const wrapper = page
                    .locator(".link-wrapper")
                    .filter({ has: page.locator(`a[href="${href}"]`) })
                    .first();
                await wrapper.locator("a").hover();

                const popover = wrapper.locator(".link-popover");
                await expect(popover).toBeVisible();
                await expect(
                    popover.locator(".link-popover-title"),
                ).not.toBeEmpty();

                // The meta line joins its fields with a separator, so the
                // count is read off the separator rather than the elements.
                const line = (
                    await popover
                        .locator(".link-popover-meta")
                        .allTextContents()
                ).join("");
                const fields = line === "" ? [] : line.split("·");
                expect(fields.length).toBeGreaterThanOrEqual(meta.min);
                expect(fields.length).toBeLessThanOrEqual(meta.max);
            });
        }
    });

    section("Print", () => {
        onlyIn("print");

        test("no popover is printed", async ({ page }) => {
            await expect(page.locator(".link-popover")).not.toHaveCount(0);

            const printed = await page.evaluate(() =>
                [...document.querySelectorAll(".link-popover")]
                    .filter((el) => el.checkVisibility())
                    .map((el) => el.textContent?.slice(0, 40)),
            );
            expect(printed).toEqual([]);
        });

        /**
         * "A link with an entry in the Bibliography should be inline-cited in
         * MLA format: e.g. (Author, Year). A link without one should print its
         * full address in plaintext instead" — design.mdx, Links › Print.
         *
         * Which branch a link falls into is decided the way the site decides
         * it: an internal link is a page of this site rather than a work, so
         * it is never an entry, whatever the page's bibliography says.
         */
        test("each link is followed by the citation or address it prints as", async ({
            page,
        }) => {
            await expect(page.locator(PROSE_LINKS)).not.toHaveCount(0);

            // Read off what a printed page would actually show: the popover is
            // still in the DOM and still carries the author and the year, so
            // anything invisible has to be skipped rather than concatenated.
            const wrong = await page.evaluate((selector) => {
                const printed = (node: Node): string => {
                    if (node.nodeType === Node.TEXT_NODE)
                        return node.textContent ?? "";
                    const el = node as Element;
                    if (!el.checkVisibility?.()) return "";
                    return [...el.childNodes].map(printed).join("");
                };

                return [...document.querySelectorAll(selector)].flatMap(
                    (link) => {
                        const href = link.getAttribute("href") ?? "";
                        const wrapper = link.closest(".link-wrapper") ?? link;
                        const paragraph = printed(wrapper.parentElement!);
                        const text = printed(link);
                        const after = paragraph.slice(
                            paragraph.indexOf(text) + text.length,
                        );

                        const expected = /^https?:/.test(href)
                            ? /^\s*\([^)]+,\s*\d{4}\)/.test(after)
                            : after.includes(href);
                        return expected
                            ? []
                            : [{ href, follows: after.slice(0, 60) }];
                    },
                );
            }, PROSE_LINKS);
            expect(wrong).toEqual([]);
        });
    });
});

import {
    expect,
    FIXTURE_PAGE,
    onlyIn,
    PROSE_LINKS,
    section,
    test,
    WIDE,
} from "./_harness";
import type { Page } from "@playwright/test";

/**
 * Which glyph a link of each kind wears.
 *
 * Restated from design.mdx rather than imported from sources.ts: the spec
 * names the four symbols outright, and a test that read them out of the
 * registry could only prove that file agrees with itself.
 */
const markFor = (href: string): string => {
    if (/^[/#]/.test(href)) return "§";
    if (/doi\.org\/10\./.test(href)) return "¶";
    if (/\.wikipedia\.org/.test(href)) return "W";
    return "↗";
};

/** A token's value as the page resolved it. */
const token = (page: Page, name: string) =>
    page.evaluate(
        (property) =>
            getComputedStyle(document.documentElement)
                .getPropertyValue(property)
                .trim(),
        `--color-${name}`,
    );

/** What the article's two pseudo-elements are drawing, if anything. */
const drawn = (page: Page) =>
    page.evaluate(() => {
        const article = document.querySelector("article")!;
        const ticks = getComputedStyle(article, "::before");
        const slug = getComputedStyle(article, "::after");
        return {
            ticks: {
                image: ticks.backgroundImage,
                arms: (ticks.backgroundImage.match(/linear-gradient/g) ?? [])
                    .length,
                inset: [ticks.top, ticks.right, ticks.bottom, ticks.left].map(
                    parseFloat,
                ),
            },
            slug: {
                content: slug.content,
                writingMode: slug.writingMode,
                colour: slug.color,
            },
            rail: article.dataset.rail ?? "",
            reach: parseFloat(
                getComputedStyle(article).getPropertyValue("--tick-reach"),
            ),
        };
    });

section("Annotation", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(FIXTURE_PAGE);
    });

    section("Wide viewports", () => {
        onlyIn(...WIDE);

        /**
         * "Outside the ink frame rather than replacing it" is the whole claim,
         * so the inset has to be negative on all four sides — a box drawn on
         * the frame, or inside it, would be one reader's mark painted over
         * another's.
         */
        test("the ticks box the article from outside its frame", async ({
            page,
        }) => {
            const { ticks, reach } = await drawn(page);

            expect(ticks.arms, "two arms at each of four corners").toBe(8);
            expect(reach).toBeGreaterThan(0);
            for (const side of ticks.inset) expect(side).toBe(-reach);
            expect(ticks.image).toContain(await token(page, "signal"));
        });

        test("a sidenote still begins outside them", async ({ page }) => {
            const { reach } = await drawn(page);
            const article = (await page.locator("article").boundingBox())!;
            const note = (await page
                .locator("article small[role='note']")
                .first()
                .boundingBox())!;

            expect(note.x).toBeGreaterThanOrEqual(
                article.x + article.width + reach,
            );
        });

        /**
         * The rail names the copy: which page, made when, from which revision.
         * The revision is absent outside a git checkout, by design, so only
         * the first two are asserted here.
         */
        test("the rail slug runs down the margin, naming the build", async ({
            page,
        }) => {
            const { slug, rail } = await drawn(page);

            expect(slug.content).not.toBe("none");
            expect(slug.writingMode).toMatch(/^vertical/);
            expect(slug.colour).toBe(await token(page, "signal"));

            expect(rail, "the page it belongs to").toContain("kitchen-sink");
            expect(rail, "the day it was built").toMatch(/\d{4}-\d{2}-\d{2}/);
        });
    });

    test("every link in the prose carries the mark of its kind", async ({
        page,
    }) => {
        await expect(page.locator(PROSE_LINKS)).not.toHaveCount(0);

        const marks = await page.evaluate(
            (selector) =>
                [...document.querySelectorAll(selector)].map((link) => ({
                    href: link.getAttribute("href") ?? "",
                    // Inside the anchor, so that it underlines along with it.
                    mark: link.querySelector(".link-mark")?.textContent ?? null,
                    // And out of the accessible name, being a symbol rather
                    // than part of what the link says.
                    hidden:
                        link
                            .querySelector(".link-mark")
                            ?.getAttribute("aria-hidden") === "true",
                })),
            PROSE_LINKS,
        );

        expect(
            marks.filter(({ href, mark }) => mark !== markFor(href)),
        ).toEqual([]);
        expect(marks.filter(({ hidden }) => !hidden)).toEqual([]);
    });

    test("a link nothing answered for keeps its mark and changes colour", async ({
        page,
    }) => {
        const mark = (href: string) =>
            page
                .locator(`${PROSE_LINKS}[href="${href}"] .link-mark`)
                .evaluate((element) => ({
                    text: element.textContent,
                    colour: getComputedStyle(element).color,
                }));

        // Both are internal, so the glyph is the same and only the ink differs.
        expect(await mark("/not-a-page")).toEqual({
            text: "§",
            colour: await token(page, "attention"),
        });
        expect(await mark("/design")).toEqual({
            text: "§",
            colour: await token(page, "signal"),
        });
    });

    section("Print", () => {
        onlyIn("print");

        test("none of it survives the press", async ({ page }) => {
            const { ticks, slug, reach } = await drawn(page);

            expect(ticks.image, "no ticks around the article").toBe("none");
            expect(slug.content, "no rail slug").toBe("none");
            expect(reach, "and nothing holding the margin open for them").toBe(
                0,
            );

            expect(
                await page.evaluate(() =>
                    [...document.querySelectorAll(".link-mark")].filter(
                        (mark) => mark.checkVisibility(),
                    ),
                ),
            ).toEqual([]);
            expect(
                await page
                    .locator("article pre")
                    .first()
                    .evaluate((pre) => getComputedStyle(pre).backgroundImage),
            ).toBe("none");
        });
    });
});

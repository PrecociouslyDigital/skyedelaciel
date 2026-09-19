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
                orientation: slug.textOrientation,
                colour: slug.color,
                /* Where the stamp actually lands, in viewport coordinates, so
                   it can be compared against the notes sharing its margin.
                   `slug.left` is measured from the article's padding box,
                   which is where an absolutely positioned child begins. */
                left:
                    article.getBoundingClientRect().x +
                    parseFloat(getComputedStyle(article).borderLeftWidth) +
                    parseFloat(slug.left),
                width: parseFloat(slug.width),
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
         * The rail dates the copy: published, edited, revision. Only the first
         * is always there — an unedited page has no second date, and a build
         * outside a git checkout has no revision — so the shape is asserted
         * whole rather than segment by segment. Nothing else may join it,
         * which is what pins the regex at both ends.
         */
        test("the rail slug dates the page", async ({ page }) => {
            const { slug, rail } = await drawn(page);

            expect(slug.content).not.toBe("none");
            expect(slug.colour).toBe(await token(page, "signal"));

            expect(rail).toMatch(
                /^\d{4}-\d{2}-\d{2}( · ed \d{4}-\d{2}-\d{2})?( · rev [0-9a-f]+)?$/,
            );
        });

        /**
         * A vertical line of upright characters, the way a seal is cut —
         * not a horizontal line turned on its side.
         */
        test("the rail slug stands its characters up", async ({ page }) => {
            const { slug } = await drawn(page);

            expect(slug.writingMode).toMatch(/^vertical/);
            expect(slug.orientation).toBe("upright");
        });

        /**
         * The stamp and the notes are both set in the right margin, by two
         * different hands, and neither may be written over the other.
         */
        test("the rail slug clears the frame and the notes", async ({
            page,
        }) => {
            const { slug, reach } = await drawn(page);
            const article = (await page.locator("article").boundingBox())!;
            const note = (await page
                .locator("article small[role='note']")
                .first()
                .boundingBox())!;

            expect(slug.left).toBeGreaterThanOrEqual(
                article.x + article.width + reach,
            );
            expect(slug.left + slug.width).toBeLessThanOrEqual(note.x);
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

        test("the boxes and the marks do not survive the press", async ({
            page,
        }) => {
            const { ticks, reach } = await drawn(page);

            expect(ticks.image, "no ticks around the article").toBe("none");
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

        /**
         * The one exception, and the reason it is one: a dateline is what a
         * sheet separated from its address has no other way to carry.
         */
        test("the stamp does", async ({ page }) => {
            const { slug } = await drawn(page);
            const article = (await page.locator("article").boundingBox())!;

            expect(slug.content).not.toBe("none");
            expect(slug.writingMode).toMatch(/^vertical/);
            expect(slug.orientation).toBe("upright");
            expect(slug.colour).toBe(await token(page, "signal"));

            expect(
                slug.left,
                "beside the text block, not over it",
            ).toBeGreaterThanOrEqual(article.x + article.width);
        });
    });
});

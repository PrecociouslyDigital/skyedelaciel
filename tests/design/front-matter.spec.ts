import { expect, onlyIn, section, SPEC_PAGE, test } from "./_harness";

/**
 * Does the first selector's element come before the second's?
 *
 * Takes its two selectors as one argument rather than closing over them: this
 * runs in the page, where nothing this file declares exists.
 */
const precedes = ([first, second]: [string, string]): boolean =>
    Boolean(
        document
            .querySelector(first)!
            .compareDocumentPosition(document.querySelector(second)!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    );

section("Front Matter", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(SPEC_PAGE);
    });

    test("it begins every article, visually set apart", async ({ page }) => {
        const article = page.locator("article");
        await expect(article.locator("> *").first()).toHaveClass(
            /front-matter/,
        );

        // "Set apart" is a judgement call; a rule between it and the body is
        // the one part of it that is mechanically visible.
        const separated = await page.locator(".front-matter").evaluate((el) => {
            const style = getComputedStyle(el);
            return (
                parseFloat(style.borderBottomWidth) > 0 ||
                parseFloat(style.marginBottom) > 0
            );
        });
        expect(separated).toBe(true);
    });

    test("the title comes first and outweighs everything else", async ({
        page,
    }) => {
        // Ancestors of the title are excluded: a wrapper "precedes" the thing
        // it wraps, which is not what "comes first" means to a reader.
        const earlier = await page.evaluate(() => {
            const title = document.querySelector(".title")!;
            return [...document.querySelectorAll(".front-matter *")]
                .filter((el) => el !== title && !el.contains(title))
                .filter(
                    (el) =>
                        title.compareDocumentPosition(el) &
                        Node.DOCUMENT_POSITION_PRECEDING,
                )
                .map((el) => el.tagName.toLowerCase());
        });
        expect(earlier, "front matter rendered before the title").toEqual([]);

        // Only elements that set their own size are weighed, and each is named
        // — an <a> filling a heading is the heading, not a second offender,
        // and a failure should say which piece of content tied with the title.
        const heavier = await page.evaluate(() => {
            const size = (el: Element) =>
                parseFloat(getComputedStyle(el).fontSize);
            const title = document.querySelector(".title")!;
            return [...document.querySelectorAll("article *")]
                .filter(
                    (el) =>
                        el !== title &&
                        !title.contains(el) &&
                        el.textContent?.trim() &&
                        size(el) !== size(el.parentElement!),
                )
                .filter((el) => size(el) >= size(title))
                .map(
                    (el) =>
                        `${el.tagName.toLowerCase()} at ${size(el)}px: ${el.textContent!.trim().slice(0, 30)}`,
                );
        });
        expect(
            heavier,
            "article content set as large as the title, or larger",
        ).toEqual([]);
    });

    test("the author follows the title, less notable than most text", async ({
        page,
    }) => {
        // DOM order is what "after the title" means for a screen reader.
        expect(
            await page.evaluate(precedes, [".title", ".author"] as [
                string,
                string,
            ]),
        ).toBe(true);

        const [titleSize, authorSize, bodySize] = await Promise.all([
            page
                .locator(".title")
                .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
            page
                .locator(".author")
                .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
            page.evaluate(() =>
                parseFloat(getComputedStyle(document.body).fontSize),
            ),
        ]);
        expect(authorSize).toBeLessThan(titleSize);
        expect(authorSize).toBeLessThan(bodySize);
    });

    section("Wide viewports", () => {
        onlyIn("wide", "print", "nojs");

        test("the author shares the title's line", async ({ page }) => {
            const title = (await page.locator(".title").boundingBox())!;
            const author = (await page.locator(".author").boundingBox())!;
            expect(author.y).toBeLessThan(title.y + title.height);
        });
    });

    section("Narrow viewports", () => {
        onlyIn("narrow");

        test("the author wraps to its own line", async ({ page }) => {
            const title = (await page.locator(".title").boundingBox())!;
            const author = (await page.locator(".author").boundingBox())!;
            expect(author.y).toBeGreaterThanOrEqual(title.y + title.height);
        });
    });

    /**
     * "Formatted similarly to article text, but still stand out at a glance."
     * Which of italics, weight, colour or indentation does the standing out is
     * the stylesheet's choice, so the test asks only that *something* does.
     */
    test("the abstract follows, article-sized but set off", async ({
        page,
    }) => {
        expect(
            await page.evaluate(precedes, [".author", ".abstract"] as [
                string,
                string,
            ]),
        ).toBe(true);

        const { differences, size, bodySize } = await page.evaluate(() => {
            const body = getComputedStyle(document.body);
            const abstract = getComputedStyle(
                document.querySelector(".abstract")!,
            );
            const distinguishing = [
                "fontStyle",
                "fontWeight",
                "fontFamily",
                "color",
                "borderLeftWidth",
                "paddingLeft",
                "backgroundColor",
            ] as const;
            return {
                size: parseFloat(abstract.fontSize),
                bodySize: parseFloat(body.fontSize),
                differences: distinguishing.filter(
                    (property) => abstract[property] !== body[property],
                ),
            };
        });

        expect(size, "article-sized").toBe(bodySize);
        expect(
            differences,
            "same size as body text, so something else has to make it stand out",
        ).not.toEqual([]);
    });
});

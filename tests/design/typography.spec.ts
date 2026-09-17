import {
    CONTENT_HEADINGS,
    expect,
    FIXTURE_PAGE,
    section,
    SPEC_PAGE,
    test,
} from "./_harness";

/** The first family of a computed `font-family`, with its quotes stripped. */
const leading = (families: string) =>
    families
        .split(",")[0]!
        .trim()
        .replace(/^["']|["']$/g, "");

section("Typography", () => {
    /**
     * Two claims in one, because either alone is worth little: a stack naming
     * the face proves nothing if the file never arrived, and a loaded file
     * proves nothing if no rule asks for it.
     */
    test("prose is Source Serif 4, headings are Cormorant, and both arrived", async ({
        page,
    }) => {
        await page.goto(FIXTURE_PAGE);

        const { body, headings, loaded } = await page.evaluate(
            async (selector) => {
                await document.fonts.ready;
                return {
                    body: getComputedStyle(document.body).fontFamily,
                    headings: [...document.querySelectorAll(selector)].map(
                        (heading) => getComputedStyle(heading).fontFamily,
                    ),
                    loaded: {
                        prose: document.fonts.check(
                            '1em "Source Serif 4 Variable"',
                        ),
                        display: document.fonts.check(
                            '600 1em "Cormorant Variable"',
                        ),
                    },
                };
            },
            CONTENT_HEADINGS,
        );

        expect(leading(body)).toBe("Source Serif 4 Variable");
        expect(headings.length).toBeGreaterThan(0);
        for (const family of headings)
            expect(leading(family)).toBe("Cormorant Variable");
        expect(loaded).toEqual({ prose: true, display: true });
    });

    /**
     * Every font file a page loads should come from this site's own origin.
     * Read off what the page actually fetched, so a stack that quietly gained a
     * Google Fonts `@import` fails here rather than in someone's network log.
     */
    test("every font the page loads comes from this origin", async ({
        page,
    }) => {
        await page.goto(SPEC_PAGE);

        const fonts = await page.evaluate(async () => {
            await document.fonts.ready;
            return performance
                .getEntriesByType("resource")
                .map((entry) => entry.name)
                .filter((name) => name.endsWith(".woff2"));
        });

        expect(fonts.length, "no font was downloaded at all").toBeGreaterThan(
            0,
        );
        const origin = new URL(page.url()).origin;
        expect(fonts.filter((name) => !name.startsWith(origin))).toEqual([]);
    });
});

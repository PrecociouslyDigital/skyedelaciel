import {
    contrast,
    expect,
    luminance,
    onlyIn,
    section,
    SPEC_PAGE,
    test,
} from "./_harness";
import type { Page } from "@playwright/test";

/** The two colours every claim below is about. */
const palette = (page: Page) =>
    page.evaluate(() => {
        const body = getComputedStyle(document.body);
        return { background: body.backgroundColor, text: body.color };
    });

section("Colors", () => {
    section("Wide viewports", () => {
        // Emulation and localStorage both need scripting; the nojs profile has
        // its own, separate claim to answer for.
        onlyIn("wide", "narrow");

        test("the scheme defaults to the system preference", async ({
            page,
        }) => {
            await page.emulateMedia({ colorScheme: "light" });
            await page.goto(SPEC_PAGE);
            const light = await palette(page);

            await page.emulateMedia({ colorScheme: "dark" });
            await page.goto(SPEC_PAGE);
            const dark = await palette(page);

            expect(dark).not.toEqual(light);
            expect(luminance(dark.background)).toBeLessThan(
                luminance(light.background),
            );
        });

        test("the toggle flips the scheme", async ({ page }) => {
            await page.emulateMedia({ colorScheme: "light" });
            await page.goto(SPEC_PAGE);
            const before = await palette(page);

            await page.locator(".theme-toggle").click();
            await expect.poll(() => palette(page)).not.toEqual(before);
        });

        /**
         * Persistence and the absence of a flash are one claim, not two: the
         * spec asks for the choice to be "persisted to local storage and
         * reloaded as early as possible in page load", and a reload that
         * settles on the right scheme only after painting the wrong one has
         * met the first half and missed the point.
         *
         * Checked through what a reader would see rather than through the
         * storage key, so the mechanism stays the implementation's business.
         */
        test("the choice survives a reload, with no flash of the old scheme", async ({
            page,
        }) => {
            await page.emulateMedia({ colorScheme: "light" });
            await page.goto(SPEC_PAGE);
            const before = await palette(page);
            await page.locator(".theme-toggle").click();
            await expect.poll(() => palette(page)).not.toEqual(before);
            const chosen = await palette(page);

            // Sample the background on every frame from the very first one. A
            // flash of the un-overridden theme would show up as a sample that
            // differs from what the page settles on.
            await page.addInitScript(() => {
                const samples: string[] = [];
                Object.assign(window, { __samples: samples });
                const sample = () => {
                    if (document.body)
                        samples.push(
                            getComputedStyle(document.body).backgroundColor,
                        );
                    if (samples.length < 5) requestAnimationFrame(sample);
                };
                requestAnimationFrame(sample);
            });

            await page.reload();
            await expect
                .poll(() =>
                    page.evaluate(
                        () =>
                            (window as { __samples?: string[] }).__samples
                                ?.length ?? 0,
                    ),
                )
                .toBeGreaterThan(0);

            expect(await palette(page), "the choice was persisted").toEqual(
                chosen,
            );

            const samples = await page.evaluate(
                () => (window as { __samples?: string[] }).__samples ?? [],
            );
            expect(
                samples.filter((sample) => sample !== chosen.background),
                "frames painted in a scheme other than the chosen one",
            ).toEqual([]);
        });

        test("muted text stays less prominent than body text, in both schemes", async ({
            page,
        }) => {
            for (const scheme of ["light", "dark"] as const) {
                await page.emulateMedia({ colorScheme: scheme });
                await page.goto(SPEC_PAGE);

                const { background, text } = await palette(page);
                const muted = await page.evaluate(() =>
                    getComputedStyle(document.documentElement)
                        .getPropertyValue("--color-muted")
                        .trim(),
                );

                expect(
                    contrast(muted, background),
                    `--color-muted must read as quieter than body text in the ${scheme} scheme`,
                ).toBeLessThan(contrast(text, background));
            }
        });
    });

    section("Print", () => {
        onlyIn("print");

        /**
         * "Three color schemes, dark, light and print" — so paper is a scheme
         * of its own: it is neither of the screen two, and unlike them it does
         * not follow `prefers-color-scheme`. Stated that way rather than as
         * the two literal colours, which are the stylesheet's to choose.
         */
        test("print gets a scheme of its own, whatever the system prefers", async ({
            page,
        }) => {
            const under = async (
                media: "screen" | "print",
                colorScheme: "light" | "dark",
            ) => {
                await page.emulateMedia({ media, colorScheme });
                await page.goto(SPEC_PAGE);
                return palette(page);
            };

            const print = await under("print", "light");
            expect(print, "paper ignores the system preference").toEqual(
                await under("print", "dark"),
            );

            const screen = [
                await under("screen", "light"),
                await under("screen", "dark"),
            ];
            for (const scheme of screen) expect(print).not.toEqual(scheme);

            // Ink on paper: the boldest contrast of the three schemes.
            expect(contrast(print.text, print.background)).toBeGreaterThan(
                Math.max(...screen.map((s) => contrast(s.text, s.background))),
            );
        });
    });
});

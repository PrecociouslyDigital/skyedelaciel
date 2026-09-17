import type { Page } from "@playwright/test";
import {
    expect,
    FIXTURE_PAGE,
    onlyIn,
    section,
    SPEC_PAGE,
    test,
} from "./_harness";

/** The design's own limit, from src/layouts/prelude/_motion.scss. */
const LIMIT_MS = 120;

/**
 * Every transition the page is actually running, wherever it was declared.
 *
 * Read off the rendered page rather than off the stylesheets, because that is
 * the only reading that covers Astro's scoped rules, Svelte's scoped rules and
 * anything a dependency brought with it alike. Pseudo-elements are walked too:
 * the popover, the tracker and the collapse chevron are all ::before.
 */
const running = (page: Page) =>
    page.evaluate(() => {
        const found: { where: string; ms: number }[] = [];

        for (const element of document.querySelectorAll("*")) {
            for (const pseudo of ["", "::before", "::after"]) {
                const style = getComputedStyle(element, pseudo || null);
                const properties = style.transitionProperty.split(", ");

                style.transitionDuration.split(", ").forEach((value, index) => {
                    const ms = parseFloat(value) * 1000;
                    if (ms <= 0) return;
                    const name = element.className || element.tagName;
                    found.push({
                        where: `${name}${pseudo} (${properties[index] ?? "?"})`,
                        ms,
                    });
                });
            }
        }
        return found;
    });

section("Motion", () => {
    // Two layouts rather than four: the declarations are the same everywhere,
    // and these are the two that render every component that has one.
    onlyIn("wide", "narrow");

    for (const path of [SPEC_PAGE, FIXTURE_PAGE]) {
        test(`nothing moves for longer than ${LIMIT_MS}ms (${path})`, async ({
            page,
        }) => {
            await page.goto(path);

            const transitions = await running(page);
            expect(
                transitions.length,
                "the page has transitions to measure",
            ).toBeGreaterThan(0);
            expect(transitions.filter(({ ms }) => ms > LIMIT_MS)).toEqual([]);
        });

        test(`a reader who asked for less motion gets none (${path})`, async ({
            page,
        }) => {
            await page.emulateMedia({ reducedMotion: "reduce" });
            await page.goto(path);

            expect(await running(page)).toEqual([]);
        });
    }
});

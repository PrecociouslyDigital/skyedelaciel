import type { Page } from "@playwright/test";
import {
    copyLink,
    expect,
    FIXTURE_PAGE,
    onlyIn,
    section,
    SPEC_PAGE,
    test,
} from "./_harness";

/** The design's own limits, from src/layouts/prelude/_motion.scss. */
const LIMIT_MS = 120;
const GROW_LIMIT_MS = 600;

/**
 * Every transition the page declares, and every keyframed animation that runs
 * on the clock rather than on the scroll, wherever it was declared, and
 * whether it is paced — a table of contents growing, or a receipt resolving
 * the word COPIED, the two things here that take a brush's time.
 *
 * Read off the rendered page rather than off the stylesheets, because that is
 * the only reading that covers Astro's scoped rules, Svelte's scoped rules and
 * anything a dependency brought with it alike. Pseudo-elements are walked too:
 * the popover, the tracker and the contents' vines are all ::before, and a
 * section of the contents grows as its ::details-content.
 */
const running = (page: Page) =>
    page.evaluate(() => {
        const found: { where: string; ms: number; growing: boolean }[] = [];

        for (const element of document.querySelectorAll("*")) {
            const growing = element.closest(".toc, .receipt-word") !== null;
            const name = element.className || element.tagName;
            for (const pseudo of [
                "",
                "::before",
                "::after",
                "::details-content",
            ]) {
                const style = getComputedStyle(element, pseudo || null);
                const record = (
                    kind: string,
                    durations: string,
                    of: string[],
                ) =>
                    durations.split(", ").forEach((value, index) => {
                        const ms = parseFloat(value) * 1000;
                        if (ms <= 0) return;
                        found.push({
                            where: `${name}${pseudo} (${kind} ${of[index] ?? "?"})`,
                            ms,
                            growing,
                        });
                    });

                record(
                    "transition",
                    style.transitionDuration,
                    style.transitionProperty.split(", "),
                );
                if (
                    style.animationName !== "none" &&
                    style.getPropertyValue("animation-timeline") === "auto"
                )
                    record(
                        "animation",
                        style.animationDuration,
                        style.animationName.split(", "),
                    );
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
            expect(
                transitions.filter(
                    ({ ms, growing }) => !growing && ms > LIMIT_MS,
                ),
            ).toEqual([]);
        });

        test(`what grows takes no longer than ${GROW_LIMIT_MS}ms (${path})`, async ({
            page,
        }) => {
            await page.goto(path);

            const growth = (await running(page)).filter(
                ({ growing }) => growing,
            );
            expect(
                growth.filter(({ ms }) => ms > LIMIT_MS).length,
                "the contents grow at a brush's pace, not a readout's",
            ).toBeGreaterThan(0);
            expect(growth.filter(({ ms }) => ms > GROW_LIMIT_MS)).toEqual([]);
        });

        test(`a copy's receipt resolves at a brush's pace, and no slower (${path})`, async ({
            page,
            context,
        }) => {
            await context.grantPermissions(["clipboard-write"]);
            await page.goto(path);
            await (await copyLink(page, "article")).click();

            const receipt = (await running(page)).filter(({ where }) =>
                where.startsWith("receipt-word"),
            );
            expect(receipt.length, "the word resolves").toBeGreaterThan(0);
            expect(receipt.filter(({ ms }) => ms > GROW_LIMIT_MS)).toEqual([]);
        });

        test(`a reader who asked for less motion gets none (${path})`, async ({
            page,
            context,
        }) => {
            await page.emulateMedia({ reducedMotion: "reduce" });
            await context.grantPermissions(["clipboard-write"]);
            await page.goto(path);
            expect(await running(page)).toEqual([]);

            // Not even a copy's receipt.
            await (await copyLink(page, "article")).click();
            await expect(
                page.locator("article [role=status]").first(),
            ).toHaveText("Link copied");
            expect(await running(page)).toEqual([]);
        });
    }
});

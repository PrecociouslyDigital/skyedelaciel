import type { Page } from "@playwright/test";
import {
    copyLink,
    expect,
    FIXTURE_PAGE,
    onlyIn,
    section,
    SPEC_PAGE,
    test,
    TUMBLR_INDEX,
} from "./_harness";

/** The design's own limits, from src/layouts/prelude/_motion.scss. */
const LIMIT_MS = 120;
const GROW_LIMIT_MS = 600;

/**
 * Every transition the page declares, and every keyframed animation that runs
 * on the clock rather than on the scroll, wherever it was declared, and
 * whether it is paced — a table of contents growing, the mark being
 * rewritten, or anything resolving, the things here that take a brush's time.
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
            const growing =
                element.closest(".toc, .receipt-word, .logo") !== null;
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
                        const what = of[index] ?? "?";
                        found.push({
                            where: `${name}${pseudo} (${kind} ${what})`,
                            ms,
                            growing: growing || /resolve/.test(what),
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

        test(`a popover resolves at a brush's pace, and no slower (${path})`, async ({
            page,
        }) => {
            await page.goto(path);
            await page
                .locator(".link-wrapper:has(.link-popover) a")
                .first()
                .hover();

            const popover = (await running(page)).filter(
                ({ where }) =>
                    where.startsWith("link-popover") &&
                    where.includes("resolve"),
            );
            expect(
                popover.filter(({ ms }) => ms > LIMIT_MS).length,
                "what is on the glass resolves",
            ).toBeGreaterThan(0);
            expect(popover.filter(({ ms }) => ms > GROW_LIMIT_MS)).toEqual([]);
        });

        test(`nothing on a popover that resolves is skipped while it is down (${path})`, async ({
            page,
        }) => {
            // Skipped contents have no style, so an animation in them is made
            // whenever the browser gets round to styling them, and only then
            // starts waiting out its standoff: the blocks would come a
            // standoff after the glass. When that is depends on the browser
            // and on what else has asked for style, so it is the arrangement
            // that is checked rather than the clock.
            await page.goto(path);
            const skipped = await page.evaluate(() => {
                const animates = (element: Element, pseudo: string | null) =>
                    /resolve/.test(
                        getComputedStyle(element, pseudo).animationName,
                    );
                const hidden = (element: Element) =>
                    getComputedStyle(element).contentVisibility === "hidden";
                const hiddenAbove = (element: Element) => {
                    for (
                        let up = element.parentElement;
                        up && !up.matches(".link-wrapper");
                        up = up.parentElement
                    )
                        if (hidden(up)) return true;
                    return false;
                };
                return [...document.querySelectorAll(".link-popover *")]
                    .filter(
                        (element) =>
                            (animates(element, null) && hiddenAbove(element)) ||
                            (animates(element, "::after") &&
                                (hidden(element) || hiddenAbove(element))),
                    )
                    .map((element) => element.className || element.tagName);
            });
            expect(skipped).toEqual([]);
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

    /**
     * An entry arrives when the growing tip reaches it, which the stylesheet
     * works out from the entry's place in its section and the section's length.
     * Both must hold for contents built from a page's headings and for those
     * built from tags Tumblr fills in.
     */
    for (const path of [FIXTURE_PAGE, TUMBLR_INDEX]) {
        test(`a section's entries arrive one after another, down it (${path})`, async ({
            page,
        }) => {
            await page.goto(path);

            const sections = await page.evaluate(() => {
                const custom = (element: Element, name: string) =>
                    getComputedStyle(element).getPropertyValue(name).trim();
                const root = document.querySelector(".toc-root")!;
                return [...root.querySelectorAll('li[data-depth="1"]')]
                    .map((section) => ({
                        length: custom(section, "--n"),
                        places: [...section.querySelectorAll("li")].map(
                            (entry) => custom(entry, "--i"),
                        ),
                    }))
                    .filter(({ places }) => places.length > 0);
            });

            expect(sections.length).toBeGreaterThan(0);
            for (const { length, places } of sections) {
                expect(length).toBe(String(places.length));
                expect(places).toEqual(places.map((_, k) => String(k)));
            }
        });
    }
});

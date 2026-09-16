import type { Page } from "@playwright/test";
import type { Box } from "./_harness";
import {
    expect,
    FIXTURE_PAGE,
    onlyIn,
    overlaps,
    section,
    test,
} from "./_harness";
import { profiles } from "../../tools/browser/profiles.mjs";

/** Every rendered sidenote body, in document order. */
async function noteBoxes(page: Page) {
    const notes = page.locator("article small[role='note']");
    const boxes: (Box | null)[] = [];
    for (let i = 0; i < (await notes.count()); i++) {
        boxes.push(await notes.nth(i).boundingBox());
    }
    return boxes;
}

/**
 * Marker, tap-to-reveal and tap-to-dismiss, which the spec asks for on narrow
 * viewports and then asks for again without scripting. One body, two profiles:
 * the claim is the same claim, and a copy of it could drift.
 */
async function togglesInline(page: Page) {
    const wrapper = page.locator(".sidenote-wrapper").first();
    const marker = wrapper.locator("label[role='doc-noteref']");
    const note = wrapper.locator("small[role='note']");

    await expect(note).toBeHidden();
    await marker.click();
    await expect(note).toBeVisible();

    // The spec offers two ways to dismiss it: the note, or the marker.
    await note.locator("label").click();
    await expect(note).toBeHidden();

    await marker.click();
    await expect(note).toBeVisible();
    await marker.click();
    await expect(note).toBeHidden();
}

section("Sidenotes", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(FIXTURE_PAGE);
    });

    section("Wide viewports", () => {
        onlyIn("wide", "print", "nojs");

        test("they are displayed to the right of the content", async ({
            page,
        }) => {
            const article = (await page.locator("article").boundingBox())!;
            for (const note of await noteBoxes(page)) {
                expect(note).not.toBeNull();
                expect(note!.x).toBeGreaterThanOrEqual(
                    article.x + article.width,
                );
            }
        });

        /**
         * "Aligned with their footnote marker as much as possible" has an
         * exact reading, and it is the one the float layout implements: a note
         * starts level with its own marker, unless the note before it is still
         * in the way, in which case it starts where that one ended.
         *
         * Tolerances come from the text itself — a marker is a superscript, so
         * its box sits inside the line rather than at the top of it.
         */
        test("each sits level with its marker, or just below the note before it", async ({
            page,
        }) => {
            const misplaced = await page.evaluate(() => {
                let previousBottom = -Infinity;
                const wrong: string[] = [];

                for (const wrapper of document.querySelectorAll(
                    ".sidenote-wrapper",
                )) {
                    const marker = wrapper
                        .querySelector("label[role='doc-noteref']")!
                        .getBoundingClientRect();
                    const note = wrapper.querySelector("small[role='note']")!;
                    const box = note.getBoundingClientRect();
                    const line = parseFloat(
                        getComputedStyle(wrapper.parentElement!).lineHeight,
                    );

                    const expected = Math.max(marker.top, previousBottom);
                    if (Math.abs(box.top - expected) > line) {
                        wrong.push(
                            `note ${wrong.length + 1}: top ${Math.round(box.top)}, expected about ${Math.round(expected)}`,
                        );
                    }
                    previousBottom = box.bottom;
                }
                return wrong;
            });
            expect(misplaced).toEqual([]);
        });

        test("no two of them overlap — they make space instead", async ({
            page,
        }) => {
            const boxes = (await noteBoxes(page)).filter(
                (box): box is Box => box !== null,
            );
            expect(boxes.length).toBeGreaterThan(1);

            const collisions = boxes.flatMap((a, i) =>
                boxes
                    .slice(i + 1)
                    .filter((b) => overlaps(a, b))
                    .map((b) => ({ a, b })),
            );
            expect(collisions).toEqual([]);
        });
    });

    section("Wide viewports, hover", () => {
        onlyIn("wide");

        test("hovering a marker highlights its note", async ({ page }) => {
            const wrapper = page.locator(".sidenote-wrapper").first();
            const note = wrapper.locator("small[role='note']");

            const before = await note.evaluate(
                (el) => getComputedStyle(el).color,
            );
            await wrapper.locator("label[role='doc-noteref']").hover();
            await expect
                .poll(() => note.evaluate((el) => getComputedStyle(el).color))
                .not.toBe(before);
        });
    });

    section("Narrow viewports", () => {
        onlyIn("narrow");

        test("hidden until tapped, and tappable closed again", async ({
            page,
        }) => {
            await togglesInline(page);
        });
    });

    section("No JavaScript", () => {
        onlyIn("nojs");

        test("showing and hiding works with scripting off", async ({
            page,
        }) => {
            // The claim is about narrow viewports, and this profile is wide,
            // so it borrows the narrow profile's width for the length of the
            // test — from the same table, rather than a second copy of it.
            await page.setViewportSize(profiles.narrow.viewport);
            await page.goto(FIXTURE_PAGE);
            await togglesInline(page);
        });
    });
});

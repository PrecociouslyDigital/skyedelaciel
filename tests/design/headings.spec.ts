import type { Page } from "@playwright/test";
import {
    CONTENT_HEADINGS,
    copyLink,
    expect,
    FIXTURE_PAGE,
    onlyIn,
    section,
    test,
    WIDE,
} from "./_harness";

/** A short heading of the fixture, well clear of the top of the page. */
const HEADING = "#default-style";

/** How long the receipt holds before it lifts, from CopyLink.svelte. */
const HOLD_MS = 1500;

const geometry = (page: Page) =>
    page.evaluate((selector) => {
        const heading = document.querySelector(selector)!;
        const rect = (el: Element) => el.getBoundingClientRect().toJSON();
        return {
            box: rect(heading.querySelector(".heading-box")!),
            words: rect(heading.querySelector(".heading-words")!),
            link: rect(heading.querySelector(".copy-link")!),
            word: rect(heading.querySelector(".receipt-word")!),
            column: rect(heading.parentElement!),
            ticked:
                getComputedStyle(
                    heading.querySelector(".heading-box")!,
                    "::before",
                ).backgroundImage !== "none",
            shown: getComputedStyle(heading.querySelector(".receipt-word")!)
                .visibility,
        };
    }, HEADING);

section("Headings", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(FIXTURE_PAGE);
    });

    test("they are set in a different font from the prose", async ({
        page,
    }) => {
        const { body, headings } = await page.evaluate(
            (selector) => ({
                body: getComputedStyle(document.body).fontFamily,
                headings: [...document.querySelectorAll(selector)].map(
                    (h) => getComputedStyle(h).fontFamily,
                ),
            }),
            CONTENT_HEADINGS,
        );

        expect(headings.length).toBeGreaterThan(0);
        for (const font of headings) expect(font).not.toBe(body);
    });

    test("each closes with its section number, its one link, to itself", async ({
        page,
    }) => {
        const headings = await page.evaluate(
            (selector) =>
                [...document.querySelectorAll(selector)].map((heading) => ({
                    id: heading.id,
                    links: [...heading.querySelectorAll("a")].map((a) => ({
                        href: a.getAttribute("href"),
                        text: a.textContent,
                    })),
                    words: heading.querySelector(".heading-words")?.textContent,
                })),
            CONTENT_HEADINGS,
        );

        expect(headings.length).toBeGreaterThan(0);
        for (const { id, links, words } of headings) {
            expect(links, id).toHaveLength(1);
            expect(links[0]!.href).toBe(`#${id}`);
            expect(links[0]!.text).toMatch(/^§ \d+(\.\d+)*$/);
            expect(words, "the words are there, and not a link").toBeTruthy();
        }
    });

    test("their numbers follow the outline, from 1", async ({ page }) => {
        const numbers = await page.evaluate(
            (selector) =>
                [...document.querySelectorAll(selector)].map(
                    (h) => h.querySelector(".copy-link")!.textContent!,
                ),
            CONTENT_HEADINGS,
        );
        expect(numbers[0]).toBe("§ 1");
        expect(new Set(numbers).size).toBe(numbers.length);
    });

    section("Copying", () => {
        onlyIn("wide", "narrow");

        test.beforeEach(async ({ context, page }) => {
            await context.grantPermissions([
                "clipboard-read",
                "clipboard-write",
            ]);
            await copyLink(page, HEADING);
        });

        test("clicking the number copies the address, sets it, and stays put", async ({
            page,
        }) => {
            const before = await page.evaluate(() => scrollY);
            await (await copyLink(page, HEADING)).click();

            await expect
                .poll(() => page.evaluate(() => navigator.clipboard.readText()))
                .toBe(`${page.url().split("#")[0]}${HEADING}`);
            expect(new URL(page.url()).hash).toBe(HEADING);
            expect(await page.evaluate(() => scrollY)).toBe(before);
        });

        test("the machine boxes the heading, tight, and writes COPIED clear of it", async ({
            page,
            profileName,
        }) => {
            await (await copyLink(page, HEADING)).click();
            await expect
                .poll(async () => (await geometry(page)).shown)
                .toBe("visible");
            const { box, words, link, word, column, ticked } =
                await geometry(page);

            expect(ticked, "the box is drawn").toBe(true);
            for (const inner of [words, link]) {
                expect(inner.left).toBeGreaterThanOrEqual(box.left - 0.5);
                expect(inner.right).toBeLessThanOrEqual(box.right + 0.5);
            }
            expect(box.width, "tight to the heading").toBeLessThan(
                column.width / 2,
            );

            if (WIDE.includes(profileName)) {
                expect(word.left, "beside the box").toBeGreaterThan(box.right);
            } else {
                expect(word.bottom, "over the box").toBeLessThan(box.top);
                expect(word.right).toBeLessThanOrEqual(box.right + 0.5);
            }
            await expect(page.locator(`${HEADING} .receipt-word`)).toHaveText(
                /copied/i,
            );
        });

        test("a screen reader hears that the link was copied", async ({
            page,
        }) => {
            await (await copyLink(page, HEADING)).click();
            await expect(page.locator(`${HEADING} [role=status]`)).toHaveText(
                "Link copied",
            );
        });

        test("the receipt lifts after a moment and a half", async ({
            page,
        }) => {
            await (await copyLink(page, HEADING)).click();
            await expect
                .poll(async () => (await geometry(page)).shown)
                .toBe("visible");

            await page.waitForTimeout(HOLD_MS + 600);
            const { shown, ticked } = await geometry(page);
            expect(shown).toBe("hidden");
            expect(ticked).toBe(false);
            await expect(page.locator(`${HEADING} [role=status]`)).toHaveText(
                "",
            );
        });

        test("under reduced motion, the receipt neither resolves nor lingers", async ({
            page,
        }) => {
            await page.emulateMedia({ reducedMotion: "reduce" });
            await (await copyLink(page, HEADING)).click();
            await expect
                .poll(async () => (await geometry(page)).shown)
                .toBe("visible");
            expect(
                await page
                    .locator(`${HEADING} .receipt-word`)
                    .evaluate((el) => el.getAnimations().length),
            ).toBe(0);

            await page.waitForTimeout(HOLD_MS + 100);
            expect((await geometry(page)).shown).toBe("hidden");
        });
    });

    section("Without scripting", () => {
        onlyIn("nojs");

        test("the number is a plain link, and following it goes there", async ({
            page,
        }) => {
            await expect(page.locator(".receipt-word")).toHaveCount(0);
            await page.locator(`${HEADING} .copy-link`).click();
            await expect(page).toHaveURL(new RegExp(`${HEADING}$`));
        });
    });

    section("Print", () => {
        onlyIn("print");

        test("the number prints as text, and nothing of the receipt does", async ({
            page,
        }) => {
            const printed = await page.evaluate((selector) => {
                const heading = document.querySelector(selector)!;
                const link = heading.querySelector(".copy-link")!;
                return {
                    number: link.checkVisibility(),
                    word: heading
                        .querySelector(".receipt-word")
                        ?.checkVisibility(),
                    color: getComputedStyle(link).color,
                    text: getComputedStyle(heading).color,
                };
            }, HEADING);
            expect(printed.number).toBe(true);
            expect(printed.word ?? false).toBe(false);
            expect(printed.color).toBe(printed.text);
        });
    });
});

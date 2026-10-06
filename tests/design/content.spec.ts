import type { Page } from "@playwright/test";
import { expect, FIXTURE_PAGE, section, SPEC_PAGE, test } from "./_harness";

/** What a pseudo-element of each match paints: its mask layers, its band and its ink. */
const strokes = (page: Page, selector: string, pseudo: string) =>
    page.evaluate(
        ([selector, pseudo]) =>
            [...document.querySelectorAll(selector)].map((el) => {
                const style = getComputedStyle(el, pseudo);
                return {
                    masks: [
                        ...style.maskImage.matchAll(/url\("?([^")]+)"?\)/g),
                    ].map((match) => match[1]!),
                    height: parseFloat(style.height),
                    width: parseFloat(style.width),
                    ink: style.backgroundColor,
                };
            }),
        [selector, pseudo] as const,
    );

/** A colour token's value, as the page resolves it. */
const token = (page: Page, name: string) =>
    page.evaluate(
        (name) =>
            getComputedStyle(document.documentElement).getPropertyValue(
                `--color-${name}`,
            ),
        name,
    );

section("Content", () => {
    for (const path of [SPEC_PAGE, FIXTURE_PAGE]) {
        test(`the measure is at most 80 characters (${path})`, async ({
            page,
        }) => {
            await page.goto(path);

            // Measured in the font the page actually rendered with, rather than
            // trusting the `80ch` in the stylesheet to mean what it says.
            const { article, eighty } = await page.evaluate(() => {
                const body = getComputedStyle(document.body);
                const probe = document.createElement("span");
                probe.textContent = "0".repeat(80);
                probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${body.font}`;
                document.body.append(probe);
                const eighty = probe.getBoundingClientRect().width;
                probe.remove();
                return {
                    article: document
                        .querySelector("article")!
                        .getBoundingClientRect().width,
                    eighty,
                };
            });

            expect(article).toBeLessThanOrEqual(eighty + 1);
        });
    }

    section("Block elements", () => {
        test.beforeEach(async ({ page }) => {
            await page.goto(FIXTURE_PAGE);
        });

        test("every table row is ruled off by a stroke in three pieces", async ({
            page,
        }) => {
            const head = await strokes(page, "article thead tr", "::after");
            const body = await strokes(page, "article tbody tr", "::after");
            expect(head.length).toBeGreaterThan(0);
            expect(body.length).toBeGreaterThan(1);

            for (const row of [...head, ...body])
                expect(row.masks).toHaveLength(3);
            for (const row of head) {
                expect(row.height).toBe(8);
                expect(row.ink).toBe(await token(page, "text"));
            }
            for (const row of body) {
                expect(row.height).toBe(4);
                expect(row.ink).toBe(await token(page, "border"));
            }
        });

        test("neighbouring body rows are ruled by different strokes", async ({
            page,
        }) => {
            const body = await strokes(page, "article tbody tr", "::after");
            for (let i = 1; i < body.length; i++)
                expect(body[i]!.masks).not.toEqual(body[i - 1]!.masks);
        });

        test("no cell draws a border of its own", async ({ page }) => {
            const bordered = await page.evaluate(
                () =>
                    [...document.querySelectorAll("article :is(th, td)")]
                        .map((cell) => getComputedStyle(cell))
                        .filter((style) =>
                            ["Top", "Right", "Bottom", "Left"].some(
                                (side) =>
                                    parseFloat(
                                        style.getPropertyValue(
                                            `border-${side.toLowerCase()}-width`,
                                        ),
                                    ) > 0,
                            ),
                        ).length,
            );
            expect(bordered).toBe(0);
        });

        test("a quotation hangs from a stroke of ink, and is at least two lines tall", async ({
            page,
        }) => {
            const quotes = await strokes(
                page,
                "article blockquote",
                "::before",
            );
            expect(quotes.length).toBeGreaterThan(0);
            for (const quote of quotes) {
                expect(quote.masks).toHaveLength(3);
                expect(quote.width).toBe(7);
                expect(quote.ink).toBe(await token(page, "text"));
            }

            const short = await page.evaluate(
                () =>
                    [...document.querySelectorAll("article blockquote")].filter(
                        (quote) =>
                            quote.getBoundingClientRect().height <
                            2 * parseFloat(getComputedStyle(quote).lineHeight),
                    ).length,
            );
            expect(short).toBe(0);
        });

        test("every stroke the page masks with is served", async ({
            page,
            profileName,
        }) => {
            test.skip(
                profileName !== "wide",
                "the same files in every profile",
            );

            const masks = [
                ...(await strokes(page, "article tr", "::after")),
                ...(await strokes(page, "article blockquote", "::before")),
                ...(await strokes(page, "small[role=note]", "::before")),
            ].flatMap((stroke) => stroke.masks);
            expect(masks.length).toBeGreaterThan(0);
            for (const url of new Set(masks)) {
                expect((await page.request.get(url)).status(), url).toBe(200);
            }
        });

        test("each depth of bullets is its own mark of the brush, in its own ink", async ({
            page,
        }) => {
            const levels = await page.evaluate(() => {
                const bullets = "ul:not([class])";
                const depth = (li: Element) => {
                    let n = 0;
                    for (let at = li.parentElement; at; at = at.parentElement)
                        if (at.matches(bullets)) n++;
                    return n;
                };
                const items = [
                    ...document.querySelectorAll(`article ${bullets} > li`),
                ];
                return [1, 2, 3].map((level) =>
                    items
                        .filter((li) => depth(li) === level)
                        .map((li) => {
                            const mark = getComputedStyle(li, "::before");
                            return {
                                ink: mark.backgroundColor,
                                mask: mark.maskImage,
                                marker: getComputedStyle(li).listStyleType,
                            };
                        }),
                );
            });

            const inks = [
                await token(page, "accent"),
                await token(page, "muted"),
                await token(page, "muted"),
            ];
            levels.forEach((items, depth) => {
                expect(
                    items.length,
                    `bullets at depth ${depth + 1}`,
                ).toBeGreaterThan(0);
                for (const item of items) {
                    expect(item.ink).toBe(inks[depth]);
                    expect(item.mask).toMatch(/^url\("data:image\/svg\+xml/);
                    expect(item.marker, "the list's own marker is gone").toBe(
                        '""',
                    );
                }
            });
            // A 點, a 橫, and a 點 again: the middle depth is drawn differently.
            expect(levels[1]![0]!.mask).not.toBe(levels[0]![0]!.mask);
            expect(levels[2]![0]!.mask).toBe(levels[0]![0]!.mask);
        });

        test("a task's square is sealed in the accent once it is done", async ({
            page,
        }) => {
            const tasks = await page.evaluate(() =>
                [...document.querySelectorAll("article .task-list-item")].map(
                    (item) => {
                        const box = item.querySelector("input")!;
                        return {
                            done: box.checked,
                            square: getComputedStyle(box).backgroundColor,
                            words: getComputedStyle(item).color,
                            appearance: getComputedStyle(box).appearance,
                        };
                    },
                ),
            );
            expect(tasks.some((task) => task.done)).toBe(true);
            expect(tasks.some((task) => !task.done)).toBe(true);
            for (const task of tasks) {
                expect(task.appearance).toBe("none");
                expect(task.square).toBe(
                    await token(page, task.done ? "accent" : "background"),
                );
                expect(task.words).toBe(
                    await token(page, task.done ? "muted" : "text"),
                );
            }
        });
    });

    section("Inline elements", () => {
        test.beforeEach(async ({ page }) => {
            await page.goto(FIXTURE_PAGE);
        });

        /** The computed values of `properties` on the first `selector` in the article. */
        const styled = (page: Page, selector: string, properties: string[]) =>
            page.evaluate(
                ([selector, properties]) => {
                    const style = getComputedStyle(
                        document.querySelector(`article ${selector}`)!,
                    );
                    return Object.fromEntries(
                        properties.map((p) => [p, style.getPropertyValue(p)]),
                    );
                },
                [selector, properties] as const,
            );

        test("a highlight is a swipe of the brush in a wash of the accent, on every line", async ({
            page,
        }) => {
            const mark = await styled(page, "mark", [
                "color",
                "background-image",
                "box-decoration-break",
            ]);
            const body = await styled(page, "p", ["color"]);
            expect(mark.color).toBe(body.color);
            expect(mark["background-image"]).toMatch(
                /^url\("data:image\/svg\+xml/,
            );
            expect(mark["box-decoration-break"]).toBe("clone");
        });

        test("a keycap is set in the monospace face on a heavier foot", async ({
            page,
        }) => {
            const kbd = await styled(page, "kbd", [
                "font-family",
                "border-top-width",
                "border-bottom-width",
            ]);
            const code = await styled(page, "code", ["font-family"]);
            expect(kbd["font-family"]).toBe(code["font-family"]);
            expect(parseFloat(kbd["border-bottom-width"]!)).toBeGreaterThan(
                parseFloat(kbd["border-top-width"]!),
            );
        });

        test("an abbreviation is set in small caps, with no underline", async ({
            page,
        }) => {
            expect(
                await styled(page, "abbr[title]", [
                    "font-variant-caps",
                    "text-decoration-line",
                ]),
            ).toEqual({
                "font-variant-caps": "all-small-caps",
                "text-decoration-line": "none",
            });
        });

        test("an edit recedes what was struck and underlines what was put in, in the accent", async ({
            page,
        }) => {
            expect((await styled(page, "del", ["color"])).color).toBe(
                await token(page, "muted"),
            );
            expect(
                await styled(page, "ins", [
                    "text-decoration-line",
                    "text-decoration-color",
                ]),
            ).toEqual({
                "text-decoration-line": "underline",
                "text-decoration-color": await token(page, "accent"),
            });
        });

        test("a definition is set in from the term it defines", async ({
            page,
        }) => {
            expect(
                (await styled(page, "dt", ["font-weight"]))["font-weight"],
            ).toBe("600");
            const dd = await page.evaluate(() => {
                const dt = document.querySelector("article dt")!;
                const dd = dt.nextElementSibling!;
                return (
                    dd.getBoundingClientRect().left -
                    dt.getBoundingClientRect().left
                );
            });
            expect(dd).toBeGreaterThan(0);
        });
    });
});

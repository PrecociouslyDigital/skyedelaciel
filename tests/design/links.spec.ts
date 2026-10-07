import type { Locator, Page } from "@playwright/test";
import {
    BANNER_HEIGHT,
    BANNER_MIN_HEIGHT,
    REM,
} from "../../src/components/mdx/links/geometry";
import type { Box } from "./_harness";
import {
    box,
    expect,
    FIXTURE_PAGE,
    onlyIn,
    PROSE_LINKS,
    section,
    test,
} from "./_harness";

/**
 * What each kind of popover may carry, counted rather than quoted.
 *
 * The strings themselves — the site name, a publication, a formatted date —
 * belong to the resolvers, and tests/unit/links.test.ts pins them there. What
 * this page can add is that the *shape* survives rendering: the spec allows
 * internal pages a site name "but not any other information", allows Wikipedia
 * its short description and no author line, and allows DOIs and external pages
 * the full author/publication/date apparatus.
 */
const STYLES = {
    "Default Style": {
        href: "https://diff.wikimedia.org/2026/10/02/capturing-essences-with-bolivian-wikimedians/",
        meta: { min: 1, max: 3 },
    },
    "Internal Pages": { href: "/fixtures/design", meta: { min: 1, max: 1 } },
    DOIs: {
        href: "https://doi.org/10.1038/s40494-025-02005-1",
        meta: { min: 1, max: 3 },
    },
    Wikipedia: {
        href: "https://en.wikipedia.org/wiki/Wang_Xizhi",
        meta: { min: 1, max: 1 },
    },
} as const;

/** The fixture links whose images are placed in each box. */
const COLUMN = STYLES.Wikipedia.href;
const BANNER = STYLES["Default Style"].href;

/** A banner whose text runs long enough to scroll. */
const LONG_BANNER = "https://en.wikipedia.org/wiki/Mount_Fuji";

/**
 * Hover a link, the first to `link` if it is an address or else the one the
 * wrapper `link` holds, and return its popover once it is up.
 */
async function open(page: Page, link: string | Locator): Promise<Locator> {
    const wrapper =
        typeof link === "string"
            ? page
                  .locator(".link-wrapper")
                  .filter({ has: page.locator(`a[href="${link}"]`) })
                  .first()
            : link;
    await wrapper.locator("a.content-link").hover();
    const popover = wrapper.locator(".link-popover");
    await expect(popover).toBeVisible();
    return popover;
}

/**
 * Rectangles of parts of a popover, relative to the pane and read in a single
 * call. The pane may still be rising into place, so two separate reads of the
 * page can disagree by however far it moved in between.
 */
const layout = <Part extends string>(
    popover: Locator,
    parts: Record<Part, string>,
): Promise<Record<Part, Box>> =>
    popover.evaluate(
        (pane, selectors: Record<string, string>) => {
            const origin = pane.getBoundingClientRect();
            return Object.fromEntries(
                Object.entries(selectors).map(([name, selector]) => {
                    const rect = pane
                        .querySelector(selector)!
                        .getBoundingClientRect();
                    return [
                        name,
                        {
                            x: rect.x - origin.x,
                            y: rect.y - origin.y,
                            width: rect.width,
                            height: rect.height,
                        },
                    ];
                }),
            ) as Record<Part, Box>;
        },
        parts as Record<string, string>,
    );

/** Scroll a popover's text to its end, returning how far it moved. */
const scrollToEnd = (popover: Locator): Promise<number> =>
    popover.locator(".link-popover-text").evaluate((text) => {
        text.scrollTop = text.scrollHeight;
        return text.scrollTop;
    });

/** How tall a popover's banner is drawn, in CSS pixels. */
const bannerHeight = (popover: Locator): Promise<number> =>
    layout(popover, { image: ".link-popover-image" }).then(
        ({ image }) => image.height,
    );

section("Links", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(FIXTURE_PAGE);
    });

    test("they are semi-bold, in body colour, and not underlined", async ({
        page,
    }) => {
        await expect(page.locator(PROSE_LINKS)).not.toHaveCount(0);

        const offenders = await page.evaluate((selector) => {
            const bodyColour = getComputedStyle(document.body).color;
            return [...document.querySelectorAll(selector)]
                .map((link) => {
                    const style = getComputedStyle(link);
                    return {
                        href: link.getAttribute("href"),
                        weight: Number(style.fontWeight),
                        colour: style.color,
                        decoration: style.textDecorationLine,
                        bodyColour,
                    };
                })
                .filter(
                    (link) =>
                        link.weight < 600 ||
                        link.colour !== link.bodyColour ||
                        link.decoration !== "none",
                );
        }, PROSE_LINKS);
        expect(offenders).toEqual([]);
    });

    section("Popover", () => {
        onlyIn("wide", "narrow");

        test("it appears above the link on hover, capped and scrollable", async ({
            page,
        }) => {
            const wrapper = page.locator(".link-wrapper").first();
            await expect(wrapper.locator(".link-popover")).toBeHidden();
            const popover = await open(page, wrapper);

            const link = await box(wrapper.locator("a.content-link"));
            const pane = await box(popover);
            expect(pane.y + pane.height).toBeLessThanOrEqual(link.y + 1);

            // "A fixed maximum size, and can be scrolled if its contents are
            // long" — so the cap has to actually bind the rendered box, and
            // the overflow it creates has to be reachable. It is the text that
            // scrolls, inside the pane, so that an image beside it holds still.
            const { cap, height, overflowY } = await popover.evaluate((el) => {
                const text = el.querySelector(".link-popover-text")!;
                return {
                    cap: parseFloat(getComputedStyle(el).maxHeight),
                    height: el.getBoundingClientRect().height,
                    overflowY: getComputedStyle(text).overflowY,
                };
            });
            expect(cap).toBeGreaterThan(0);
            expect(height).toBeLessThanOrEqual(cap + 1);
            expect(["scroll", "auto"]).toContain(overflowY);
        });

        test("the pointer can travel from the link into the popover", async ({
            page,
        }) => {
            // Scrolling a popover means reaching it first, so the standoff it
            // keeps from its link has to be ground the pointer can stand on.
            // Crossing it here is deliberately slow: the popover is given
            // longer than its own fade to close, and has to still be there.
            const FADE_OUT = 1000;

            const wrapper = page
                .locator(".link-wrapper")
                .filter({ hasText: "OpenGraph Link" })
                .first();
            const popover = await open(page, wrapper);

            const link = await box(wrapper.locator("a.content-link"));
            const pane = await box(popover);

            await page.mouse.move(
                link.x + link.width / 2,
                (pane.y + pane.height + link.y) / 2,
            );
            await page.waitForTimeout(FADE_OUT);
            await expect(popover).toBeVisible();

            await page.mouse.move(
                pane.x + pane.width / 2,
                pane.y + pane.height / 2,
            );
            await page.waitForTimeout(FADE_OUT);
            await expect(popover).toBeVisible();
        });

        test("every popover is the same width, however long its contents", async ({
            page,
        }) => {
            // The other half of "a fixed maximum size": a popover is not
            // allowed to grow sideways to fit what it was given.
            const widths = new Set<number>();
            for (const { href } of Object.values(STYLES)) {
                widths.add((await box(await open(page, href))).width);
            }
            expect([...widths]).toHaveLength(1);
        });

        test("no popover runs past the edge of the screen", async ({
            page,
        }) => {
            // Every popover on the page, read where it would open. A hidden
            // pane is still laid out, so none needs hovering to be measured;
            // one inside something collapsed has no box, and is skipped.
            const overflowing = await page.evaluate(() =>
                [...document.querySelectorAll(".link-popover")]
                    .map((pane) => ({
                        link: pane
                            .closest(".link-wrapper")!
                            .querySelector("a")!
                            .textContent!.trim(),
                        box: pane.getBoundingClientRect(),
                    }))
                    .filter(
                        ({ box }) =>
                            box.width > 0 &&
                            (box.left < 0 || box.right > innerWidth),
                    )
                    .map(({ link, box }) => ({
                        link,
                        left: box.left,
                        right: box.right,
                    })),
            );
            expect(overflowing).toEqual([]);
        });

        test("title first, metadata second, then the body", async ({
            page,
        }) => {
            const wrapper = page
                .locator(".link-wrapper")
                .filter({ hasText: "OpenGraph Link" })
                .first();
            await open(page, wrapper);

            const order = await wrapper
                .locator(".link-popover-text")
                .evaluate((el) =>
                    [...el.children].map((child) =>
                        child.className.replace("link-popover-", ""),
                    ),
                );
            expect(order.slice(0, 3)).toEqual(["title", "meta", "description"]);

            expect(
                await wrapper
                    .locator(".link-popover-meta")
                    .evaluate((el) => getComputedStyle(el).fontStyle),
            ).toBe("italic");
        });

        for (const [heading, { href, meta }] of Object.entries(STYLES)) {
            test(`${heading}: the popover carries what that kind of link knows`, async ({
                page,
            }) => {
                const popover = await open(page, href);
                await expect(
                    popover.locator(".link-popover-title"),
                ).not.toBeEmpty();

                // The meta line joins its fields with a separator, so the
                // count is read off the separator rather than the elements.
                const line = (
                    await popover
                        .locator(".link-popover-meta")
                        .allTextContents()
                ).join("");
                const fields = line === "" ? [] : line.split("·");
                expect(fields.length).toBeGreaterThanOrEqual(meta.min);
                expect(fields.length).toBeLessThanOrEqual(meta.max);
            });
        }

        test("a tall image stands to the right of the text, a wide one above it", async ({
            page,
        }) => {
            for (const [href, placement] of [
                [COLUMN, "column"],
                [BANNER, "banner"],
            ] as const) {
                const popover = await open(page, href);
                await expect(popover).toHaveAttribute("data-image", placement);

                const { image, text } = await layout(popover, {
                    image: ".link-popover-image",
                    text: ".link-popover-text",
                });
                if (placement === "column") {
                    expect(image.x).toBeGreaterThanOrEqual(
                        text.x + text.width - 1,
                    );
                } else {
                    expect(image.y + image.height).toBeLessThanOrEqual(
                        text.y + 1,
                    );
                }
            }
        });

        /**
         * A cropped image has lost part of itself and a stretched one is
         * squeezed, and either can only happen in a box of another shape
         * than the image. So the box has the image's shape, and it runs the
         * pane's height: as far in from the bottom of the pane as from the
         * top, with no glass left over below it.
         */
        test("a column image runs whole from the top of the pane to the bottom", async ({
            page,
        }) => {
            const popover = await open(page, COLUMN);
            const { box, image, above, below } = await popover.evaluate(
                (pane) => {
                    const img = pane.querySelector(".link-popover-image")!;
                    const outer = pane.getBoundingClientRect();
                    const rect = img.getBoundingClientRect();
                    return {
                        box: rect.width / rect.height,
                        image:
                            Number(img.getAttribute("width")) /
                            Number(img.getAttribute("height")),
                        above: rect.top - outer.top,
                        below: outer.bottom - rect.bottom,
                    };
                },
            );
            expect(box / image).toBeCloseTo(1, 2);
            expect(below).toBeCloseTo(above, 0);
        });

        test("a column image holds still while the text scrolls past it", async ({
            page,
        }) => {
            const popover = await open(page, COLUMN);
            const image = () =>
                layout(popover, { image: ".link-popover-image" }).then(
                    (parts) => parts.image,
                );

            const before = await image();
            expect(await scrollToEnd(popover)).toBeGreaterThan(0);
            // To the half pixel: a pane still rising is transformed, which
            // leaves float noise in the rectangles but moves nothing.
            const after = await image();
            expect(after.x).toBeCloseTo(before.x, 0);
            expect(after.y).toBeCloseTo(before.y, 0);
        });

        /**
         * The banner's resting height and its floor are read from
         * geometry.ts, the same numbers the stylesheet draws with.
         */
        test("a banner gives way as the text scrolls, but never goes", async ({
            page,
        }) => {
            const popover = await open(page, LONG_BANNER);
            expect(await bannerHeight(popover)).toBeCloseTo(
                BANNER_HEIGHT * REM,
                0,
            );

            expect(await scrollToEnd(popover)).toBeGreaterThan(0);
            await expect
                .poll(() => bannerHeight(popover))
                .toBeCloseTo(BANNER_MIN_HEIGHT * REM, 0);
        });

        test("under reduced motion, a banner holds still", async ({ page }) => {
            await page.emulateMedia({ reducedMotion: "reduce" });
            const popover = await open(page, LONG_BANNER);

            expect(await scrollToEnd(popover)).toBeGreaterThan(0);
            // One frame for a scroll-driven animation, had there been one.
            await page.evaluate(
                () => new Promise((done) => requestAnimationFrame(done)),
            );
            expect(await bannerHeight(popover)).toBeCloseTo(
                BANNER_HEIGHT * REM,
                0,
            );
        });

        /**
         * At rest the popover is a page preview; the ledger comes after it,
         * for a reader who asks for more by scrolling.
         */
        test("the ledger follows the summary, and scrolling reaches all of it", async ({
            page,
        }) => {
            const popover = await open(page, COLUMN);
            const parts = {
                summary: ".link-popover-description",
                ledger: ".link-popover-ledger",
                text: ".link-popover-text",
            };

            const { summary, ledger } = await layout(popover, parts);
            expect(ledger.y).toBeGreaterThanOrEqual(summary.y + summary.height);

            await scrollToEnd(popover);
            const scrolled = await layout(popover, parts);
            expect(
                scrolled.ledger.y + scrolled.ledger.height,
            ).toBeLessThanOrEqual(scrolled.text.y + scrolled.text.height + 1);
        });

        /**
         * fixtures/design.mdx, Typography: "every font file a page loads should come
         * from this site's own origin, so that reading a page announces the
         * reader to nobody else." An image in a popover is the same promise.
         */
        test("every popover image is served from this site", async ({
            page,
        }) => {
            const sources = await page
                .locator(".link-popover-image")
                .evaluateAll((images) =>
                    images.map((image) => (image as HTMLImageElement).src),
                );
            expect(sources).not.toHaveLength(0);
            const origin = new URL(page.url()).origin;
            expect(
                sources.filter((src) => new URL(src).origin !== origin),
            ).toEqual([]);
        });

        test("no popover image is fetched until its popover opens", async ({
            page,
        }) => {
            const requested: string[] = [];
            page.on("request", (request) => requested.push(request.url()));
            await page.reload({ waitUntil: "networkidle" });

            const sources = await page
                .locator(".link-popover-image")
                .evaluateAll((images) =>
                    images.map((image) => (image as HTMLImageElement).src),
                );
            expect(requested.filter((url) => sources.includes(url))).toEqual(
                [],
            );

            const popover = await open(page, COLUMN);
            const src = await popover
                .locator(".link-popover-image")
                .evaluate((image) => (image as HTMLImageElement).src);
            await expect.poll(() => requested).toContain(src);
        });
    });

    section("Print", () => {
        onlyIn("print");

        test("no popover is printed", async ({ page }) => {
            await expect(page.locator(".link-popover")).not.toHaveCount(0);

            const printed = await page.evaluate(() =>
                [...document.querySelectorAll(".link-popover")]
                    .filter((el) => el.checkVisibility())
                    .map((el) => el.textContent?.slice(0, 40)),
            );
            expect(printed).toEqual([]);
        });

        /**
         * "A link with an entry in the Bibliography should be inline-cited in
         * MLA format: e.g. (Author, Year). A link without one should print its
         * full address in plaintext instead" — fixtures/design.mdx, Links › Print.
         *
         * Which branch a link falls into is decided the way the site decides
         * it: an internal link is a page of this site rather than a work, so
         * it is never an entry, whatever the page's bibliography says.
         */
        test("each link is followed by the citation or address it prints as", async ({
            page,
        }) => {
            await expect(page.locator(PROSE_LINKS)).not.toHaveCount(0);

            // Read off what a printed page would actually show: the popover is
            // still in the DOM and still carries the author and the year, so
            // anything invisible has to be skipped rather than concatenated.
            const wrong = await page.evaluate((selector) => {
                const printed = (node: Node): string => {
                    if (node.nodeType === Node.TEXT_NODE)
                        return node.textContent ?? "";
                    const el = node as Element;
                    if (!el.checkVisibility?.()) return "";
                    return [...el.childNodes].map(printed).join("");
                };

                return [...document.querySelectorAll(selector)].flatMap(
                    (link) => {
                        const href = link.getAttribute("href") ?? "";
                        const wrapper = link.closest(".link-wrapper") ?? link;
                        const paragraph = printed(wrapper.parentElement!);
                        const text = printed(link);
                        const after = paragraph.slice(
                            paragraph.indexOf(text) + text.length,
                        );

                        const expected = /^https?:/.test(href)
                            ? /^\s*\([^)]+,\s*\d{4}\)/.test(after)
                            : after.includes(href);
                        return expected
                            ? []
                            : [{ href, follows: after.slice(0, 60) }];
                    },
                );
            }, PROSE_LINKS);
            expect(wrong).toEqual([]);
        });
    });
});

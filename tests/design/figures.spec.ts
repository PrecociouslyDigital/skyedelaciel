import type { Page } from "@playwright/test";
import {
    copyLink,
    expect,
    FIXTURE_PAGE,
    onlyIn,
    section,
    SPEC_PAGE,
    test,
    token,
} from "./_harness";

/** The two figures of the fixture: one taller than wide, one wider. */
const PORTRAIT = "#fig-wang-xizhi";
const LANDSCAPE = "#fig-mount-fuji";

/** Where each part of a figure lies on the page. */
const parts = (page: Page, figure: string) =>
    page.evaluate((selector) => {
        const el = document.querySelector(selector)!;
        const rect = (part: Element) => part.getBoundingClientRect().toJSON();
        return {
            figure: rect(el),
            plate: rect(el.querySelector(".plate")!),
            image: rect(el.querySelector(".plate img")!),
            caption: rect(el.querySelector("figcaption")!),
            column: rect(el.parentElement!),
            columnStyle: (() => {
                const style = getComputedStyle(el.parentElement!);
                // How far its content stands in from its edges.
                return {
                    left:
                        parseFloat(style.paddingLeft) +
                        parseFloat(style.borderLeftWidth),
                    right:
                        parseFloat(style.paddingRight) +
                        parseFloat(style.borderRightWidth),
                };
            })(),
        };
    }, figure);

section("Figures", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(FIXTURE_PAGE);
    });

    section("Images", () => {
        test("every image in the prose is a numbered figure, in order", async ({
            page,
        }) => {
            const figures = await page.evaluate(() => ({
                // A link's popover carries a picture of where it leads,
                // which is not the page's own.
                loose: [
                    ...document.querySelectorAll(
                        "article img:not(.link-popover img)",
                    ),
                ].filter((img) => !img.closest("figure.figure[id^='fig-']"))
                    .length,
                labels: [
                    ...document.querySelectorAll(
                        "figure.figure figcaption .copy-link",
                    ),
                ].map((link) => link.textContent),
            }));
            expect(figures.loose).toBe(0);
            expect(figures.labels).toEqual(
                figures.labels.map((_, i) => `Fig. ${i + 1}`),
            );
            expect(figures.labels.length).toBeGreaterThanOrEqual(2);
        });

        test("a figure, its plate and its caption are one width, and the figure is centred", async ({
            page,
        }) => {
            for (const figure of [PORTRAIT, LANDSCAPE]) {
                const {
                    figure: box,
                    plate,
                    caption,
                    column,
                    columnStyle,
                } = await parts(page, figure);
                expect(plate.width).toBeCloseTo(box.width, 0);
                expect(caption.width).toBeCloseTo(box.width, 0);

                const inner = {
                    left: column.left + columnStyle.left,
                    right: column.right - columnStyle.right,
                };
                expect(box.left - inner.left).toBeCloseTo(
                    inner.right - box.right,
                    0,
                );
            }
            for (const figure of [PORTRAIT, LANDSCAPE]) {
                const {
                    figure: box,
                    column,
                    columnStyle,
                } = await parts(page, figure);
                const drawn = await page
                    .locator(figure)
                    .evaluate((el) =>
                        parseFloat(
                            getComputedStyle(el).getPropertyValue(
                                "--plate-width",
                            ),
                        ),
                    );
                const room =
                    column.width - columnStyle.left - columnStyle.right;
                expect(
                    box.width,
                    "as wide as its plate was drawn, or the column",
                ).toBeCloseTo(Math.min(drawn, room), 0);
            }
        });

        test("the image is set inside its plate, clear of the frame", async ({
            page,
        }) => {
            for (const figure of [PORTRAIT, LANDSCAPE]) {
                const { plate, image } = await parts(page, figure);
                for (const [outer, inner] of [
                    [image.left, plate.left],
                    [image.top, plate.top],
                    [plate.right, image.right],
                    [plate.bottom, image.bottom],
                ] as const)
                    expect(outer - inner).toBeGreaterThan(4);
            }
        });

        test("every plate is served", async ({ page, profileName }) => {
            test.skip(profileName !== "wide", "the same files everywhere");
            const plates = await page.evaluate(() =>
                [...document.querySelectorAll(".figure .plate")].map(
                    (plate) =>
                        /url\("?([^")]+)"?\)/.exec(
                            getComputedStyle(plate, "::before").maskImage,
                        )?.[1],
                ),
            );
            expect(plates.length).toBeGreaterThan(0);
            for (const url of plates) {
                expect(url).toBeTruthy();
                expect((await page.request.get(url!)).status(), url).toBe(200);
            }
        });
    });

    section("Copying", () => {
        onlyIn("wide", "narrow");

        test("the machine boxes the figure outside it, and writes COPIED under its corner", async ({
            page,
            context,
        }) => {
            await context.grantPermissions([
                "clipboard-read",
                "clipboard-write",
            ]);
            await (await copyLink(page, LANDSCAPE)).click();

            await expect
                .poll(() => page.evaluate(() => navigator.clipboard.readText()))
                .toBe(`${page.url().split("#")[0]}${LANDSCAPE}`);
            await expect(
                page.locator(`${LANDSCAPE} .receipt-word`),
            ).toBeVisible();

            const { figure, box, word, ticked } = await page.evaluate(
                (selector) => {
                    const figure = document.querySelector(selector)!;
                    const before = getComputedStyle(figure, "::before");
                    const outset = parseFloat(before.top);
                    const rect = figure.getBoundingClientRect();
                    return {
                        figure: rect.toJSON(),
                        box: {
                            top: rect.top + outset,
                            right: rect.right - outset,
                            bottom: rect.bottom - outset,
                        },
                        word: figure
                            .querySelector(".receipt-word")!
                            .getBoundingClientRect()
                            .toJSON(),
                        ticked: before.backgroundImage !== "none",
                    };
                },
                LANDSCAPE,
            );
            expect(ticked).toBe(true);
            expect(box.top, "the box stands outside the figure").toBeLessThan(
                figure.top,
            );
            expect(box.right).toBeGreaterThan(figure.right);
            expect(word.top, "under the box").toBeGreaterThanOrEqual(
                box.bottom,
            );
            expect(word.right).toBeCloseTo(box.right, 0);
        });
    });

    section("Tables", () => {
        test("a table's caption stands above it", async ({ page }) => {
            const tables = await page.evaluate(() =>
                [...document.querySelectorAll("figure.table-figure")].map(
                    (figure) => ({
                        id: figure.id,
                        caption: figure
                            .querySelector("figcaption")!
                            .getBoundingClientRect().bottom,
                        table: figure
                            .querySelector("table")!
                            .getBoundingClientRect().top,
                        label: figure.querySelector("figcaption .copy-link")!
                            .textContent,
                    }),
                ),
            );
            expect(tables.length).toBeGreaterThan(0);
            tables.forEach((table, i) => {
                expect(table.id).toMatch(/^tab-/);
                expect(table.label).toBe(`Table ${i + 1}`);
                expect(table.caption).toBeLessThanOrEqual(table.table);
            });
        });

        test("every table in the prose is a numbered figure", async ({
            page,
        }) => {
            for (const path of [FIXTURE_PAGE, SPEC_PAGE]) {
                await page.goto(path);
                const loose = await page.evaluate(
                    () =>
                        [...document.querySelectorAll("article table")].filter(
                            (table) => !table.closest("figure.table-figure"),
                        ).length,
                );
                expect(loose, path).toBe(0);
            }
        });
    });

    section("Listings", () => {
        const LISTING = "#lst-the-woodblock-frame";

        test("every block of code is a numbered listing, stamped with its language and length", async ({
            page,
        }) => {
            for (const path of [FIXTURE_PAGE, SPEC_PAGE]) {
                await page.goto(path);
                const listings = await page.evaluate(() => ({
                    loose: [...document.querySelectorAll("article pre")].filter(
                        (pre) => !pre.closest("figure.listing"),
                    ).length,
                    each: [...document.querySelectorAll("figure.listing")].map(
                        (listing) => ({
                            label: listing.querySelector(".copy-link")!
                                .textContent,
                            stamp: listing.querySelector(".listing-stamp")!
                                .textContent,
                            lines: listing.querySelectorAll("pre .line").length,
                            lang: listing
                                .querySelector("pre")!
                                .getAttribute("data-language"),
                        }),
                    ),
                }));
                expect(listings.loose, path).toBe(0);
                listings.each.forEach((listing, i) => {
                    expect(listing.label).toBe(`Listing ${i + 1}`);
                    expect(listing.stamp).toBe(
                        `${listing.lang} · ${listing.lines}`,
                    );
                });
            }
        });

        test("nothing in a listing is styled inline", async ({ page }) => {
            const styled = await page.evaluate(
                () =>
                    document.querySelectorAll("figure.listing [style]").length,
            );
            expect(styled).toBe(0);
        });

        test("its tokens are inked with the site's own pigments, in either scheme", async ({
            page,
            profileName,
        }) => {
            test.skip(profileName === "print", "print has its own scheme");
            for (const colorScheme of ["light", "dark"] as const) {
                await page.emulateMedia({ colorScheme });
                await page.goto(FIXTURE_PAGE);
                const inks = await page.evaluate(() => {
                    const ink = (selector: string) => {
                        const el = document.querySelector(
                            `figure.listing ${selector}`,
                        );
                        return el && getComputedStyle(el).color;
                    };
                    return {
                        keyword: ink(".tok-keyword"),
                        literal: ink(".tok-literal"),
                        builtin: ink(".tok-builtin"),
                        comment: ink(".tok-comment"),
                    };
                });
                expect(inks).toEqual({
                    keyword: await token(page, "accent"),
                    literal: await token(page, "signal"),
                    builtin: await token(page, "attention"),
                    comment: await token(page, "muted"),
                });
            }
        });

        test("it is framed thick and thin, and no box of the machine's", async ({
            page,
        }) => {
            const pre = await page.locator(`${LISTING} pre`).evaluate((pre) => {
                const style = getComputedStyle(pre);
                return {
                    border: style.borderTopWidth,
                    image: style.backgroundImage,
                    shadows: style.boxShadow.split(/,(?![^(]*\))/).length,
                };
            });
            expect(pre).toEqual({ border: "3px", image: "none", shadows: 2 });
        });

        test("selecting the code takes no line numbers", async ({ page }) => {
            const { selected, code } = await page
                .locator(`${LISTING} pre code`)
                .evaluate((code) => {
                    const range = document.createRange();
                    range.selectNodeContents(code);
                    const selection = getSelection()!;
                    selection.removeAllRanges();
                    selection.addRange(range);
                    return {
                        selected: selection.toString(),
                        code: code.textContent,
                    };
                });
            expect(selected.trim()).toBe(code!.trim());
            expect(selected).not.toMatch(/^\s*1\s*@mixin/);
        });

        test("Copy puts exactly the code on the clipboard", async ({
            page,
            context,
            profileName,
        }) => {
            test.skip(
                !["wide", "narrow"].includes(profileName),
                "needs a script and a screen",
            );
            await context.grantPermissions([
                "clipboard-read",
                "clipboard-write",
            ]);
            await page.locator(LISTING).scrollIntoViewIfNeeded();
            const button = page.locator(`${LISTING} .copy-code`);
            await button.click();

            const code = await page
                .locator(`${LISTING} pre code`)
                .evaluate((code) => code.textContent);
            await expect
                .poll(() =>
                    page.evaluate(async () =>
                        // The system clipboard may use CRLF line endings.
                        (await navigator.clipboard.readText()).replaceAll(
                            "\r\n",
                            "\n",
                        ),
                    ),
                )
                .toBe(code);
            await expect(button).toHaveAttribute("data-copied");
            await expect(
                page.locator(`${LISTING} [role=status]`).last(),
            ).toHaveText("Code copied");
        });

        test("without a script there is no Copy to press", async ({
            page,
            profileName,
        }) => {
            test.skip(profileName !== "nojs", "only without a script");
            await expect(page.locator(".copy-code")).toHaveCount(0);
        });
    });

    section("References", () => {
        test("a link to a figure or table reads as its number", async ({
            page,
        }) => {
            const references = await page.evaluate(() =>
                [
                    ...document.querySelectorAll(
                        "article a.content-link[href^='#fig-'], article a.content-link[href^='#tab-']",
                    ),
                ].map((link) => {
                    const target = document.querySelector(
                        link.getAttribute("href")!,
                    )!;
                    return {
                        says: link.firstChild!.textContent!.trim(),
                        number: target.querySelector("figcaption .copy-link")!
                            .textContent!,
                    };
                }),
            );
            expect(references.length).toBeGreaterThanOrEqual(3);
            for (const { says, number } of references)
                expect(says).toBe(
                    number
                        .replace(/^Fig\. /, "Figure ")
                        .replace(/^Table /, "Table "),
                );
        });

        test("no two things on the page share an id", async ({ page }) => {
            for (const path of [FIXTURE_PAGE, SPEC_PAGE]) {
                await page.goto(path);
                const ids = await page.evaluate(() =>
                    [...document.querySelectorAll("[id]")].map((el) => el.id),
                );
                expect(ids.length - new Set(ids).size, path).toBe(0);
            }
        });
    });

    section("Print", () => {
        onlyIn("print");

        test("a figure keeps its plate, number, caption and credit, and none of the receipt", async ({
            page,
        }) => {
            const printed = await page.evaluate((selector) => {
                const figure = document.querySelector(selector)!;
                const visible = (part: string) =>
                    figure.querySelector(part)?.checkVisibility() ?? false;
                return {
                    plate: getComputedStyle(
                        figure.querySelector(".plate")!,
                        "::before",
                    ).maskImage,
                    number: visible(".copy-link"),
                    caption: visible("figcaption"),
                    credit: visible(".credit"),
                    word: visible(".receipt-word"),
                };
            }, LANDSCAPE);
            expect(printed.plate).toMatch(/^url\(/);
            expect(printed).toMatchObject({
                number: true,
                caption: true,
                credit: true,
                word: false,
            });
        });
    });
});

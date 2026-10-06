import { compile } from "@mdx-js/mdx";
import { fileURLToPath } from "node:url";
import remarkGfm from "remark-gfm";
import { describe, expect, test } from "vitest";
import remarkFigures, { drawnSize } from "../../src/plugins/remark-figures";
import { chance } from "../../src/layouts/prelude/chance.mjs";

const root = new URL("../../", import.meta.url);

/** A page beside the fixture images, so `./images/…` finds them. */
const PAGE = fileURLToPath(
    new URL("src/content/fixtures/figures-test.mdx", root),
);

const FUJI =
    '![Fuji above a ridge.](./images/mount-fuji.jpg "Fuji from Ōwakudani.")';
const TABLE = "| a | b |\n| - | - |\n| 1 | 2 |";

const build = (value: string) =>
    compile(
        { value, path: PAGE },
        { remarkPlugins: [remarkGfm, [remarkFigures, { root }]] },
    ).then(String);

describe("a page of figures", () => {
    test("each figure and table is numbered, and a reference fills itself in", async () => {
        const out = await build(
            [
                "See [](#fig-mount-fuji) and [](#tab-pairs).",
                FUJI,
                "Credit: Photograph by Suicasmo",
                "Table: Pairs.",
                TABLE,
            ].join("\n\n"),
        );
        expect(out).toContain('"Figure 1"');
        expect(out).toContain('"Table 1"');
        expect(out).toContain('id: "fig-mount-fuji"');
        expect(out).toContain('label: "Fig. 1"');
        expect(out).toContain('id: "tab-pairs"');
        expect(out).toMatch(
            /import __plate0 from "\/\.astro\/drawings\/\w+\.svg\?url"/,
        );
    });

    test("a reference with words of its own keeps them", async () => {
        const out = await build(
            ["As [the photograph](#fig-mount-fuji) shows.", FUJI].join("\n\n"),
        );
        expect(out).toContain('"the photograph"');
        expect(out).not.toContain('"Figure 1"');
    });
});

describe("a page that cannot be cited fails", () => {
    const fails = (name: string, value: string, reason: RegExp) =>
        test(name, async () => {
            await expect(build(value)).rejects.toThrow(reason);
        });

    fails(
        "a figure with no caption",
        "![Fuji above a ridge.](./images/mount-fuji.jpg)",
        /caption/,
    );
    fails(
        "a figure with no alt text",
        '![](./images/mount-fuji.jpg "Fuji.")',
        /alt text/,
    );
    fails(
        "an image sharing its paragraph",
        `Look: ${FUJI}`,
        /alone in its paragraph/,
    );
    fails(
        "an image by an absolute address",
        '![Fuji.](https://example.com/fuji.jpg "Fuji.")',
        /relative path/,
    );
    fails("a table with no caption", TABLE, /Table: caption/);
    fails(
        "a credit with no figure",
        "Credit: nobody in particular",
        /belongs to nothing/,
    );
    fails(
        "a caption with no table",
        "Table: Nothing.\n\nJust words.",
        /belongs to nothing/,
    );
    fails(
        "two figures with one id",
        [FUJI, FUJI].join("\n\n"),
        /#fig-mount-fuji/,
    );
    fails(
        "a reference to a figure that is not there",
        "See [](#fig-elsewhere).",
        /names nothing/,
    );
});

describe("the size a figure is drawn at", () => {
    const sizes = Array.from({ length: 300 }, (_, i) => {
        const r = chance(`size ${i}`);
        return {
            width: 20 + r.integer(4000),
            height: 20 + r.integer(4000),
        };
    });

    test("is never wider than 640, taller than 720, or larger than the image", () => {
        for (const natural of sizes) {
            const { width, height } = drawnSize(natural);
            expect(width).toBeLessThanOrEqual(640);
            expect(height).toBeLessThanOrEqual(720);
            expect(width).toBeLessThanOrEqual(natural.width);
        }
    });

    test("keeps the image's shape, to the nearest pixel", () => {
        for (const natural of sizes) {
            const { width, height } = drawnSize(natural);
            const exact = (width * natural.height) / natural.width;
            if (exact <= 720)
                expect(Math.abs(height - exact)).toBeLessThanOrEqual(0.5);
        }
    });
});

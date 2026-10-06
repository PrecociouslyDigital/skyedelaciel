import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as sass from "sass";
import {
    blossom,
    hanging,
    shoot,
    tocVine,
    vine,
} from "../../src/layouts/prelude/vine.mjs";

const prelude = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../src/layouts/prelude",
);

const SHAPES = [
    { ratio: 5.5, centred: false },
    { ratio: 4, centred: false },
    { ratio: 8, centred: true },
    { ratio: 10, centred: true },
];
const SEEDS = [1, 2, 3, 4, 17, 99];
const INKS = { leaf: "#26642b", flower: "#58508c" };

/**
 * A rule's vine is fixed by where it appears: the same place always shows the
 * same drawing, from one build to the next. If the generator reached for
 * anything but its seed, a page would change every time it was built.
 */
describe("a vine is its arguments", () => {
    for (const shape of SHAPES) {
        for (const seed of SEEDS) {
            const args = { ...shape, seed, ...INKS };
            test(`ratio ${shape.ratio}, seed ${seed}, drawn twice, is drawn the same`, () => {
                expect(vine(args)).toBe(vine(args));
            });
        }
    }

    test("different seeds draw different vines", () => {
        const drawn = SEEDS.map((seed) =>
            vine({ ...SHAPES[0]!, seed, ...INKS }),
        );
        expect(new Set(drawn).size).toBe(SEEDS.length);
    });
});

describe("a vine is a whole drawing", () => {
    for (const shape of SHAPES) {
        for (const seed of SEEDS) {
            const svg = vine({ ...shape, seed, ...INKS });

            test(`ratio ${shape.ratio}, seed ${seed} is ${shape.ratio} times as wide as it is tall`, () => {
                const [, width, height] =
                    /viewBox='0 0 ([\d.]+) ([\d.]+)'/.exec(svg) ?? [];
                expect(Number(width) / Number(height)).toBeCloseTo(shape.ratio);
            });

            test(`ratio ${shape.ratio}, seed ${seed} has no undrawable coordinate`, () => {
                expect(svg).not.toMatch(/NaN|undefined|Infinity/);
            });

            test(`ratio ${shape.ratio}, seed ${seed} has a stem and at least one rose`, () => {
                expect(svg).toContain(`fill='${INKS.leaf}'`);
                expect(svg).toContain(`fill='${INKS.flower}'`);
            });
        }
    }
});

/**
 * The site's own rules, in both screen schemes' inks, are fixed drawings:
 * sharing the paint with the table of contents' pieces must not move a mark.
 */
describe("the rules are the drawings they always were", () => {
    test("the four rules, in paper and ink, are unchanged", () => {
        const hash = createHash("sha256");
        for (const [ratio, seed, centred] of [
            [5.5, 1, false],
            [4, 2, false],
            [8, 3, true],
            [10, 4, true],
        ] as const) {
            for (const inks of [INKS, { leaf: "#8dce8e", flower: "#bdb7fc" }])
                hash.update(vine({ ratio, seed, centred, ...inks }));
        }
        expect(hash.digest("hex")).toBe(
            "15fa2c5f51b0c6572e87195e3389fbe975b19768ccbbfa260aee9e2795b6c16c",
        );
    });
});

/** Half a row of the contents, in widths of its vine; see _ornaments.scss. */
const RISE = 0.8 / 1.3;

const TOC_INKS = {
    ...INKS,
    iron: "#0e100f",
    pot: "#565c58",
    ground: "#ffffff",
};

/** Each piece of the contents, drawn from a seed. */
const PIECES = {
    "a section's vine": (seed: number) =>
        tocVine({ ratio: 6, seed, ...TOC_INKS }),
    "a shoot": (seed: number) =>
        shoot({ reach: 1.4, radius: 0.4, seed, ...TOC_INKS }).svg,
    "a blossom": (seed: number) => blossom({ seed, ...TOC_INKS }).svg,
    "a hanging shoot": (seed: number) =>
        hanging({ seed, rise: RISE, ...TOC_INKS }).svg,
};

describe("a piece of the contents is its arguments", () => {
    for (const [name, draw] of Object.entries(PIECES)) {
        test(`${name}, drawn twice, is drawn the same`, () => {
            for (const seed of SEEDS) expect(draw(seed)).toBe(draw(seed));
        });

        test(`${name} has no undrawable coordinate`, () => {
            for (const seed of SEEDS)
                expect(draw(seed)).not.toMatch(/NaN|undefined|Infinity/);
        });
    }
});

describe("a section's vine grows down its column, bare", () => {
    for (const seed of SEEDS) {
        test(`seed ${seed} is as long as asked, and as wide as a rule is tall`, () => {
            const ratio = 7.5;
            const [, width, height] =
                /viewBox='0 0 ([\d.]+) ([\d.]+)'/.exec(
                    tocVine({ ratio, seed, ...TOC_INKS }),
                ) ?? [];
            expect(Number(height) / Number(width)).toBeCloseTo(ratio);
        });

        test(`seed ${seed} turned upright is the rule turned, not another vine`, () => {
            const across = vine({ ratio: 5, seed, centred: false, ...INKS });
            const down = vine({
                ratio: 5,
                seed,
                centred: false,
                upright: true,
                ...INKS,
            });
            const marks = (svg: string) => (svg.match(/[MZ]/g) ?? []).length;
            expect(marks(down)).toBe(marks(across));
        });

        test(`seed ${seed} without blooms has no rose`, () => {
            expect(
                vine({
                    ratio: 8,
                    seed,
                    centred: false,
                    blooms: false,
                    ...INKS,
                }),
            ).not.toContain(`fill='${INKS.flower}'`);
        });
    }
});

/**
 * A piece is set out by the box it reports, so the box has to hold the
 * drawing, and the point it is placed by has to lie within reach of it.
 */
describe("a piece's box is where its drawing is", () => {
    const placed = {
        "a shoot": (seed: number) =>
            shoot({ reach: 1.4, radius: 0.4, seed, ...TOC_INKS }),
        "a blossom": (seed: number) => blossom({ seed, ...TOC_INKS }),
        "a hanging shoot": (seed: number) =>
            hanging({ seed, rise: RISE, ...TOC_INKS }),
    };
    for (const [name, draw] of Object.entries(placed)) {
        test(`${name}'s box is its drawing's viewBox, a frame at a time`, () => {
            for (const seed of SEEDS) {
                const drawn = draw(seed);
                const { svg, box } = drawn;
                const frames = "frames" in drawn ? Number(drawn.frames) : 1;
                const [, w, h] =
                    /viewBox='[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)'/.exec(svg) ??
                    [];
                expect(Number(w) / Number(h)).toBeCloseTo(
                    (box.w * frames) / box.h,
                );
            }
        });

        test(`${name} is drawn about a point at its edge or inside it`, () => {
            for (const seed of SEEDS) {
                const { box } = draw(seed);
                expect(box.x).toBeLessThanOrEqual(0);
                expect(box.y).toBeLessThanOrEqual(0);
                expect(box.x + box.w).toBeGreaterThanOrEqual(0);
                expect(box.y + box.h).toBeGreaterThanOrEqual(0);
            }
        });
    }
});

/** What `contrast.fit` gives, and how it measures, for one pigment on one ground. */
function fitted(pigment: string, ground: string, ratio: number) {
    const css = sass.compileString(
        `@use "sass:color";
        @use "contrast";
        $fitted: contrast.fit(${pigment}, ${ground}, ${ratio});
        a {
            ratio: contrast.contrast($fitted, ${ground});
            hue: color.channel($fitted, "hue", $space: oklch);
            pigment-hue: color.channel(${pigment}, "hue", $space: oklch);
            nearer: contrast.contrast(color.mix($fitted, ${ground}, 97%), ${ground});
        }`,
        { loadPaths: [prelude] },
    ).css;
    const read = (name: string) =>
        Number(new RegExp(`\\b${name}: ([\\d.e-]+)`).exec(css)![1]);
    return {
        ratio: read("ratio"),
        hue: read("hue"),
        pigmentHue: read("pigment-hue"),
        nearer: read("nearer"),
    };
}

/**
 * Each scheme's chromas are fitted rather than chosen: for every pigment and
 * every ground, the colour meets the ratio, keeps the pigment's hue, and goes
 * no further from the ground than it has to.
 */
describe("a fitted chroma stands exactly as far from its ground as asked", () => {
    const PIGMENTS = ["#645c9a", "oklch(50% 0.11 145)", "#907f93", "#a8321e"];
    const GROUNDS = ["#fff", "#f8f6f3", "#1b1e21", "#2f3235"];
    for (const pigment of PIGMENTS) {
        for (const ground of GROUNDS) {
            for (const ratio of [4.5, 6.5, 9]) {
                const fit = fitted(pigment, ground, ratio);

                test(`${pigment} on ${ground} reaches ${ratio}:1`, () => {
                    expect(fit.ratio).toBeGreaterThanOrEqual(ratio);
                });

                test(`${pigment} on ${ground} at ${ratio}:1 goes no further than it must`, () => {
                    expect(fit.nearer).toBeLessThan(ratio);
                });

                test(`${pigment} on ${ground} at ${ratio}:1 keeps its hue`, () => {
                    const turn = Math.abs(fit.hue - fit.pigmentHue) % 360;
                    expect(Math.min(turn, 360 - turn)).toBeLessThan(6);
                });
            }
        }
    }
});

import { describe, expect, test } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as sass from "sass";
import { vine } from "../../src/layouts/prelude/vine.mjs";

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

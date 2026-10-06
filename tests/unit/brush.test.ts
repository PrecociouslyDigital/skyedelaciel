import { describe, expect, test } from "vitest";
import {
    brushStroke,
    plate,
    RULED,
    strokePiece,
} from "../../src/layouts/prelude/brush.mjs";
import { chance } from "../../src/layouts/prelude/chance.mjs";

const SEEDS = Array.from({ length: 40 }, (_, i) => `seed-${i}`);
const AXES = ["across", "down"] as const;
const PIECES = ["head", "body", "tail"] as const;

/** Every point a path's data visits, as [x, y]. */
const points = (svg: string) => {
    const d = /d='([^']*)'/.exec(svg)?.[1] ?? "";
    const numbers = d.match(/-?[\d.]+/g)?.map(Number) ?? [];
    return numbers.flatMap((_, i) =>
        i % 2 ? [] : [[numbers[i]!, numbers[i + 1]!] as const],
    );
};

const viewBox = (svg: string) =>
    (/viewBox='([^']*)'/.exec(svg)?.[1] ?? "").split(" ").map(Number) as [
        number,
        number,
        number,
        number,
    ];

describe("a stroke is its seed", () => {
    for (const axis of AXES) {
        for (const piece of PIECES) {
            test(`the ${axis} ${piece}, drawn twice, is drawn the same`, () => {
                for (const seed of SEEDS) {
                    const args = { seed, axis, piece };
                    expect(strokePiece(args).svg).toBe(strokePiece(args).svg);
                }
            });
        }
    }

    test("different seeds draw different strokes", () => {
        const drawn = SEEDS.map(
            (seed) => strokePiece({ seed, axis: "across", piece: "body" }).svg,
        );
        expect(new Set(drawn).size).toBe(SEEDS.length);
    });
});

describe("a stroke is three pieces of one line", () => {
    for (const axis of AXES) {
        const along = axis === "across" ? 0 : 1;

        test(`the ${axis} pieces tile the line from end to end`, () => {
            const spans = PIECES.map((piece) => {
                const box = viewBox(
                    strokePiece({ seed: "x", axis, piece }).svg,
                );
                return [box[along], box[along] + box[along + 2]!];
            });
            expect(spans[0]![0]).toBe(0);
            expect(spans[1]![0]).toBe(spans[0]![1]);
            expect(spans[2]![0]).toBe(spans[1]![1]);
            expect(spans[2]![1]).toBe(1200);
        });

        test(`each ${axis} piece's box is its view box, in bands`, () => {
            for (const piece of PIECES) {
                const { svg, box } = strokePiece({ seed: "x", axis, piece });
                const [, , w, h] = viewBox(svg);
                expect([box.w, box.h]).toEqual([w / 40, h / 40]);
            }
        });

        test(`each ${axis} piece paints only near its own stretch`, () => {
            for (const seed of SEEDS) {
                for (const piece of PIECES) {
                    const { svg } = strokePiece({ seed, axis, piece });
                    const box = viewBox(svg);
                    const [lo, hi] = [box[along], box[along] + box[along + 2]!];
                    const reach = points(svg).map((p) => p[along]);
                    expect(reach.length).toBeGreaterThan(0);
                    expect(Math.min(...reach)).toBeGreaterThanOrEqual(lo - 1.1);
                    expect(Math.max(...reach)).toBeLessThanOrEqual(hi + 1.1);
                }
            }
        });
    }

    test("no piece has a coordinate that is not a number", () => {
        for (const seed of SEEDS) {
            for (const axis of AXES) {
                for (const piece of PIECES) {
                    for (const ruled of [false, true]) {
                        const { svg } = strokePiece({
                            seed,
                            axis,
                            piece,
                            ruled,
                        });
                        expect(svg).not.toMatch(/NaN|Infinity/);
                    }
                }
            }
        }
    });
});

describe("a ruled stroke is straighter than a free one", () => {
    /** How far the paint strays from the line it was drawn along. */
    const stray = (seed: string, style: object) => {
        const { solids } = brushStroke(
            chance(seed),
            [
                [30, 20],
                [1170, 20],
            ],
            style,
        );
        // The middle of the line, clear of the head's swelling and the tail's
        // filaments.
        const ys = solids[0]!
            .filter(([x]) => x > 200 && x < 1000)
            .map(([, y]) => y);
        return Math.max(...ys) - Math.min(...ys);
    };

    test("for every seed", () => {
        for (const seed of SEEDS) {
            expect(stray(seed, RULED)).toBeLessThan(stray(seed, {}));
        }
    });
});

describe("a plate is ruled round", () => {
    const SIZES = [
        { width: 308, height: 420 },
        { width: 676, height: 366 },
        { width: 120, height: 120 },
    ];

    test("drawn twice from one seed, it is drawn the same", () => {
        const args = { ...SIZES[0]!, seed: "fig-x" };
        expect(plate(args)).toBe(plate(args));
    });

    test("it paints the middle of all four sides, and nothing that is not a number", () => {
        for (const size of SIZES) {
            for (const seed of SEEDS.slice(0, 10)) {
                const svg = plate({ ...size, seed });
                expect(svg).not.toMatch(/NaN|Infinity/);

                const [, , W, H] = viewBox(svg);
                const band = 0.1 * Math.min(W, H);
                const middle = (v: number, of: number) =>
                    v > of * 0.35 && v < of * 0.65;
                const all = points(svg);
                const sides = {
                    top: all.some(([x, y]) => middle(x, W) && y < band),
                    bottom: all.some(([x, y]) => middle(x, W) && y > H - band),
                    left: all.some(([x, y]) => middle(y, H) && x < band),
                    right: all.some(([x, y]) => middle(y, H) && x > W - band),
                };
                expect(sides).toEqual({
                    top: true,
                    bottom: true,
                    left: true,
                    right: true,
                });
            }
        }
    });
});

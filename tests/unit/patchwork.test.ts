import { describe, expect, test } from "vitest";
import { laidDown, quilt } from "../../src/layouts/prelude/patchwork.mjs";

const GRIDS = [
    { cols: 16, rows: 12 },
    { cols: 5, rows: 3 },
    { cols: 1, rows: 1 },
];
const SEEDS = [1, 7, 105, 9001];

type Patch = ReturnType<typeof quilt>[number];

/** Every cell a patch covers, as "x,y". */
const cells = ({ x, y, w, h }: Patch) =>
    Array.from(
        { length: w * h },
        (_, i) => `${x + (i % w)},${y + Math.floor(i / w)}`,
    );

const key = ({ x, y }: Patch) => `${x},${y}`;

describe("a quilt", () => {
    for (const { cols, rows } of GRIDS) {
        for (const seed of SEEDS) {
            const patches = quilt({ cols, rows, seed });

            test(`${cols}×${rows}, seed ${seed}: covers every cell exactly once`, () => {
                const covered = patches.flatMap(cells).sort();
                const grid = Array.from(
                    { length: cols * rows },
                    (_, i) => `${i % cols},${Math.floor(i / cols)}`,
                ).sort();
                expect(covered).toEqual(grid);
            });

            test(`${cols}×${rows}, seed ${seed}: no patch is larger than three by two`, () => {
                for (const { w, h } of patches) {
                    expect(w).toBeLessThanOrEqual(3);
                    expect(h).toBeLessThanOrEqual(2);
                }
            });

            test(`${cols}×${rows}, seed ${seed}: is its arguments`, () => {
                expect(quilt({ cols, rows, seed })).toEqual(patches);
            });
        }
    }
});

describe("a quilt laid down", () => {
    const FRAMES = 6;

    for (const seed of SEEDS) {
        const grid = { cols: 16, rows: 12, seed, frames: FRAMES };
        const arriving = laidDown({ ...grid, order: 1 });
        const leaving = laidDown({ ...grid, order: 2 });

        test(`seed ${seed}: each frame holds the one before it`, () => {
            for (const frames of [arriving, leaving]) {
                for (let f = 1; f < frames.length; f++) {
                    const now = new Set(frames[f]!.map(key));
                    for (const patch of frames[f - 1]!) {
                        expect(now.has(key(patch))).toBe(true);
                    }
                    expect(frames[f]!.length).toBeGreaterThan(
                        frames[f - 1]!.length,
                    );
                }
            }
        });

        test(`seed ${seed}: the last frame is the whole quilt, in either order`, () => {
            const whole = quilt(grid).map(key).sort();
            expect(arriving.at(-1)!.map(key).sort()).toEqual(whole);
            expect(leaving.at(-1)!.map(key).sort()).toEqual(whole);
        });

        test(`seed ${seed}: the two orders lay it down differently`, () => {
            expect(arriving[0]!.map(key).sort()).not.toEqual(
                leaving[0]!.map(key).sort(),
            );
        });
    }
});

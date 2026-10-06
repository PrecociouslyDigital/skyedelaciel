import { describe, expect, test } from "vitest";
import { chance } from "../../src/layouts/prelude/chance.mjs";
import { SkippedLevel, sectionNumbers } from "../../src/plugins/numbering";

const SEEDS = Array.from({ length: 200 }, (_, i) => i);

/**
 * A page's heading depths that skip no level: it starts at its shallowest,
 * and each heading goes at most one level deeper than the one before.
 */
function outline(seed: number): number[] {
    const r = chance(seed);
    const top = 1 + r.integer(3);
    const depths = [top];
    for (let n = r.integer(40); n > 0; n--) {
        const previous = depths.at(-1)!;
        depths.push(top + r.integer(Math.min(previous + 1, 6) - top + 1));
    }
    return depths;
}

/** The same outline with one heading pushed a level too deep. */
function skipping(seed: number): { depths: number[]; at: number } {
    const depths = outline(seed);
    const at = chance(`skip ${seed}`).integer(depths.length + 1);
    const before = at === 0 ? Math.min(...depths) - 1 : depths[at - 1]!;
    depths.splice(at, 0, before + 2);
    return { depths, at };
}

const parts = (number: string) => number.split(".").map(Number);
const parent = (number: string) => number.split(".").slice(0, -1).join(".");

describe("section numbers, for every outline that skips no level", () => {
    const outlines = SEEDS.map((seed) => {
        const depths = outline(seed);
        return { depths, numbers: sectionNumbers(depths) };
    });

    test("the first is 1", () => {
        for (const { numbers } of outlines) expect(numbers[0]).toBe("1");
    });

    test("no two are the same", () => {
        for (const { numbers } of outlines)
            expect(new Set(numbers).size).toBe(numbers.length);
    });

    test("a number has a part for each level below the top", () => {
        for (const { depths, numbers } of outlines) {
            const top = Math.min(...depths);
            numbers.forEach((number, i) =>
                expect(parts(number)).toHaveLength(depths[i]! - top + 1),
            );
        }
    });

    test("a heading extends the number of the one it falls under", () => {
        for (const { depths, numbers } of outlines) {
            numbers.forEach((number, i) => {
                const over = depths
                    .slice(0, i)
                    .findLastIndex((depth) => depth < depths[i]!);
                if (over >= 0) expect(parent(number)).toBe(numbers[over]);
            });
        }
    });

    test("siblings count up from 1, a step at a time", () => {
        for (const { depths, numbers } of outlines) {
            numbers.forEach((number, i) => {
                const last = parts(number).at(-1)!;
                const before = depths
                    .slice(0, i)
                    .findLastIndex((depth) => depth <= depths[i]!);
                const sibling = before >= 0 && depths[before] === depths[i];
                expect(last).toBe(
                    sibling ? parts(numbers[before]!).at(-1)! + 1 : 1,
                );
            });
        }
    });
});

describe("an outline that skips a level", () => {
    test("throws, naming the heading that skipped", () => {
        for (const seed of SEEDS) {
            const { depths, at } = skipping(seed);
            let thrown: unknown;
            try {
                sectionNumbers(depths);
            } catch (error) {
                thrown = error;
            }
            expect(thrown).toBeInstanceOf(SkippedLevel);
            expect((thrown as SkippedLevel).index).toBeLessThanOrEqual(at);
        }
    });
});

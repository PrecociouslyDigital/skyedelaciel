import { describe, expect, test } from "vitest";
import type { Placement } from "~/components/mdx/links/geometry";
import {
    boxAspect,
    boxes,
    crossover,
    DENSITY,
    drawnWidth,
    suitability,
    placement,
    REM,
    sourceWidth,
    tooSmall,
} from "~/components/mdx/links/geometry";

/**
 * Aspect ratios from a sliver to a panorama, spaced evenly on a log scale so
 * that tall and wide images get the same attention.
 */
const ASPECTS = Array.from({ length: 401 }, (_, i) => 2 ** ((i - 200) / 40));

const other = (where: Placement): Placement =>
    where === "column" ? "banner" : "column";

describe("placement", () => {
    test("the chosen box suits the image at least as well as the other would", () => {
        for (const aspect of ASPECTS) {
            const where = placement(aspect, 1);
            expect(
                suitability(aspect, boxAspect(where)),
            ).toBeGreaterThanOrEqual(
                suitability(aspect, boxAspect(other(where))),
            );
        }
    });

    test("the crossover is where both boxes suit an image equally", () => {
        expect(suitability(crossover, boxAspect("column"))).toBeCloseTo(
            suitability(crossover, boxAspect("banner")),
        );
    });

    test("tall images go in the column, wide ones in the banner", () => {
        expect(placement(400, 500)).toBe("column");
        expect(placement(1200, 630)).toBe("banner");
    });

    test("only the shape decides, not the size", () => {
        for (const aspect of ASPECTS) {
            expect(placement(aspect * 3000, 3000)).toBe(placement(aspect, 1));
        }
    });
});

describe("tooSmall", () => {
    /**
     * `placeImage` copies an image at `min(its width, sourceWidth)`. Whatever
     * `tooSmall` lets through, that copy is at least as wide as it is drawn,
     * so nothing that reaches a popover is enlarged.
     */
    test("an image it lets through is never drawn larger than its copy", () => {
        for (const aspect of ASPECTS) {
            for (const width of [16, 64, 120, 240, 416, 1000, 4000]) {
                const height = width / aspect;
                if (tooSmall(width, height)) continue;
                const where = placement(width, height);
                const copy = Math.min(width, sourceWidth(where, aspect));
                expect(copy).toBeGreaterThanOrEqual(drawnWidth(where, aspect));
            }
        }
    });

    test("an image narrower than its drawn width is left out", () => {
        for (const aspect of ASPECTS) {
            const drawn = drawnWidth(placement(aspect, 1), aspect);
            expect(tooSmall(drawn - 1, (drawn - 1) / aspect)).toBe(true);
            expect(tooSmall(drawn, drawn / aspect)).toBe(false);
        }
    });
});

describe("sourceWidth", () => {
    /**
     * Scaled the way `object-fit` scales it — up to the larger of the two
     * ratios to cover, the smaller to fit inside — a copy of that width is
     * shrunk rather than stretched: at least `DENSITY` of its pixels land on
     * each CSS pixel. And it is no bigger than that needs, give or take the
     * pixel it was rounded up by.
     */
    test("a copy of that width is drawn at full density, and no more", () => {
        for (const aspect of ASPECTS) {
            for (const where of ["column", "banner"] as const) {
                const width = sourceWidth(where, aspect);
                const height = width / aspect;
                const box = boxes[where];
                const scaled = box.fit === "cover" ? Math.max : Math.min;
                const scale = scaled(
                    (box.width * REM) / width,
                    (box.height * REM) / height,
                );
                expect(scale).toBeLessThanOrEqual(1 / DENSITY);
                expect(scale).toBeGreaterThanOrEqual(
                    ((width - 1) / width) * (1 / DENSITY),
                );
            }
        }
    });
});

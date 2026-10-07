// @ts-check
/* What the site's drawing modules share: plane geometry, easing, and the
   frame an SVG is written in. Plain JS, so that Sass can call it while it
   compiles; see src/integrations/vines.ts. */

/** @typedef {[number, number]} Point */

export const TAU = 2 * Math.PI;

/** @type {(a: number, b: number, t: number) => number} */
export const lerp = (a, b, t) => a + (b - a) * t;

/** 0 up to `a`, 1 from `b`, and an S-curve between. @type {(a: number, b: number, x: number) => number} */
export const smoothstep = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

/**
 * The `i`th of `list`, which the caller knows is there. Unlike `.at()`, a
 * negative `i` names nothing.
 *
 * @template T
 * @param {readonly T[]} list
 * @param {number} i
 * @returns {T}
 */
export const nth = (list, i) => /** @type {T} */ (list[i]);

/** @type {<T>(list: readonly T[]) => T} */
export const last = (list) => nth(list, list.length - 1);

/**
 * How far along a polyline each of its points is.
 *
 * @param {Point[]} points
 * @returns {number[]}
 */
export function arcLengths(points) {
    const lengths = [0];
    for (let i = 1; i < points.length; i++) {
        const [p, q] = [nth(points, i - 1), nth(points, i)];
        lengths.push(
            nth(lengths, i - 1) + Math.hypot(q[0] - p[0], q[1] - p[1]),
        );
    }
    return lengths;
}

/**
 * An SVG of `body` over `viewBox`, with any other `attributes` its root
 * takes, written as a stylesheet's `url()` can hold it: single quotes only.
 *
 * @param {string} viewBox
 * @param {string} body
 * @param {string} [attributes]
 */
export const svgOf = (viewBox, body, attributes = "") =>
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${viewBox}'${attributes}>${body}</svg>`;

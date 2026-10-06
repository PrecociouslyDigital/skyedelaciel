// @ts-check
/* A seeded PRNG (cyrb53-style hash into mulberry32), so a seed is a drawing.
   Any number or string seeds one sequence. Plain JS, so that Sass can draw
   with it while it compiles; see src/integrations/vines.ts. */
/**
 * @typedef {object} Chance
 * @property {(lo: number, hi: number) => number} between A number in [lo, hi).
 * @property {(p: number) => boolean} odds Whether a chance of `p` comes up.
 * @property {() => number} sign 1 or -1, each as likely.
 * @property {(n: number) => number} integer An integer in [0, n).
 * @property {<T>(list: readonly T[]) => T} pick One of `list`, each as likely.
 */

/**
 * @param {number | string} seed
 * @returns {Chance}
 */
export function chance(seed) {
    let h = 0x9e3779b9;
    for (const c of String(seed))
        h = Math.imul(h ^ c.charCodeAt(0), 0x5bd1e995) ^ (h >>> 15);
    let a = h >>> 0;
    const next = () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const integer = (/** @type {number} */ n) => Math.floor(next() * n);
    /**
     * @template T
     * @param {readonly T[]} list
     */
    const pick = (list) => /** @type {T} */ (list[integer(list.length)]);
    return {
        between: (lo, hi) => lo + (hi - lo) * next(),
        odds: (p) => next() < p,
        sign: () => (next() < 0.5 ? -1 : 1),
        integer,
        pick,
    };
}

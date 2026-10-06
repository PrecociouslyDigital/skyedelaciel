/* A seeded PRNG (cyrb53-style hash into mulberry32), so a seed is a drawing.
   Any number or string seeds one sequence. Plain JS, so that Sass can draw
   with it while it compiles; see src/integrations/vines.ts. */
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
    return {
        between: (lo, hi) => lo + (hi - lo) * next(),
        odds: (p) => next() < p,
        sign: () => (next() < 0.5 ? -1 : 1),
        integer: (n) => Math.floor(next() * n),
    };
}

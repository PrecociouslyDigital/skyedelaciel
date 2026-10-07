// @ts-check
/* The logo's brush, for every straight line the site paints rather than
   rules: a port of the stroke model in ~/data/logo-brush.py, which painted
   the logo. Strokes are drawn in the logo's units, where a stroke is 19.5
   units wide, as its hexagon's are, and scaled by the call site. Plain JS,
   so that Sass can call it while it compiles; see src/integrations/vines.ts. */

import { chance } from "./chance.mjs";
import { arcLengths, last, nth, smoothstep, svgOf, TAU } from "./pen.mjs";

/** @typedef {import("./chance.mjs").Chance} Chance */
/** @typedef {import("./pen.mjs").Point} Point */
/** A function of distance along a stroke. @typedef {(s: number) => number} Profile */
/** One edge of a stroke, or the other. @typedef {-1 | 1} Side */
/**
 * Something of each edge.
 *
 * @template T
 * @typedef {{ "-1": T, "1": T }} Ragged
 */

/** @type {(p: Point, q: Point) => number} */
const distance = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

/* — The hand — */

/* Smooth 1-D noise in roughly [-1, 1]: the slow drift of a hand. */
/** @param {Chance} r @param {number} wavelength @returns {Profile} */
function wobble(r, wavelength, terms = 3) {
    /** @type {[number, number][]} */
    const waves = Array.from({ length: terms }, () => [
        TAU / (wavelength * r.between(0.6, 1.6)),
        r.between(0, TAU),
    ]);
    return (s) =>
        (waves.reduce((sum, [k, phase]) => sum + Math.sin(k * s + phase), 0) /
            terms) *
        1.6;
}

/* Value noise with jittered knots: the tooth of a brush edge on paper. */
/** @param {Chance} r @param {number} spacing @param {number} length @returns {Profile} */
function grain(r, spacing, length) {
    const knots = [0];
    while (last(knots) <= length + spacing)
        knots.push(last(knots) + spacing * r.between(0.4, 1.6));
    const values = knots.map(() => r.sign() * r.between(0, 1) ** 2);
    let i = 0;
    return (s) => {
        s = Math.min(Math.max(s, 0), last(knots));
        if (nth(knots, i) > s) i = 0;
        while (i < knots.length - 2 && nth(knots, i + 1) <= s) i++;
        const f = smoothstep(nth(knots, i), nth(knots, i + 1), s);
        return nth(values, i) + (nth(values, i + 1) - nth(values, i)) * f;
    };
}

/* Soft bulges where ink pooled and bled past the brush. */
/**
 * @param {Chance} r
 * @param {number} length
 * @param {number} count
 * @param {[number, number]} height
 * @param {[number, number]} spread
 * @returns {Profile}
 */
function bleed(r, length, count, height, spread) {
    /** @type {[number, number, number][]} */
    const bumps = Array.from({ length: count }, () => [
        r.between(0, length),
        r.between(...height),
        r.between(...spread),
    ]);
    return (s) =>
        bumps.reduce(
            (sum, [c, h, w]) => sum + h * Math.exp(-(((s - c) / w) ** 2)),
            0,
        );
}

/* — The stroke — */

/* Distance along a polyline at each point, and the unit normal there. */
/**
 * @param {Point[]} points
 * @returns {[number[], Point[]]}
 */
function frame(points) {
    const lengths = arcLengths(points);
    const normals = points.map((_, i) => {
        const [x0, y0] = nth(points, Math.max(i - 1, 0));
        const [x1, y1] = nth(points, Math.min(i + 1, points.length - 1));
        const d = Math.hypot(x1 - x0, y1 - y0);
        return /** @type {Point} */ ([-(y1 - y0) / d, (x1 - x0) / d]);
    });
    return [lengths, normals];
}

/* A centreline with a width and two ragged edges along it. `u` runs across
   the stroke from -1 on one edge to 1 on the other. */
class Stroke {
    /**
     * @param {Point[]} points
     * @param {Profile} width
     * @param {Ragged<Profile>} ragged
     */
    constructor(points, width, ragged) {
        this.points = points;
        const [s, normals] = frame(points);
        /** How far along the stroke each point is. */
        this.s = s;
        this.normals = normals;
        this.length = last(this.s);
        this.widths = this.s.map(width);
        this.ragged = {
            [-1]: this.s.map(ragged[-1]),
            [1]: this.s.map(ragged[1]),
        };
    }

    /**
     * The point `u` of the way across the stroke at its `i`th point, and
     * `outward` further out.
     *
     * @param {number} i
     * @param {number} u
     * @returns {Point}
     */
    at(i, u, outward = 0) {
        const [x, y] = nth(this.points, i);
        const [nx, ny] = nth(this.normals, i);
        const off =
            (nth(this.widths, i) / 2) * u + (u >= 0 ? outward : -outward);
        return [x + nx * off, y + ny * off];
    }

    /** @param {number} i @param {Side} side */
    edge(i, side) {
        return this.at(i, side, nth(this.ragged[side], i));
    }
}

/**
 * @param {Chance} r
 * @param {number} length
 * @param {number} tooth
 * @param {number} pooling
 * @param {number} dryFrom
 * @returns {Ragged<Profile>}
 */
function raggedEdges(r, length, tooth, pooling, dryFrom) {
    const side = () => {
        const fine = grain(r, 2.5, length);
        const drift = wobble(r, 45);
        const pooled = bleed(
            r,
            length,
            2 + r.integer(3),
            [0.4, pooling],
            [4, 14],
        );
        return (/** @type {number} */ s) => {
            const dryness = smoothstep(dryFrom, length, s);
            return (
                fine(s) * tooth * (1 + 3 * dryness) + drift(s) * 0.5 + pooled(s)
            );
        };
    };
    return { [-1]: side(), [1]: side() };
}

/* The rounded, slightly lopsided head where the brush touched down. */
/** @param {Chance} r @returns {(stroke: Stroke) => Point[]} */
function startCap(r) {
    const lean = r.between(-0.3, 0.3);
    const g = grain(r, 0.25, Math.PI);
    return (stroke) => {
        const [x, y] = nth(stroke.points, 0);
        const [nx, ny] = nth(stroke.normals, 0);
        const [tx, ty] = [ny, -nx];
        const half = nth(stroke.widths, 0) / 2;
        /** @type {Point[]} */
        const out = [];
        for (let j = 1; j < 24; j++) {
            const a = -Math.PI / 2 - (Math.PI * j) / 24;
            const reach = half * (1 + 0.08 * g((Math.PI * j) / 24));
            const across = reach * Math.sin(a);
            const back = reach * (0.85 + lean * Math.sin(a)) * Math.cos(a);
            out.push([
                x + nx * across + tx * back,
                y + ny * across + ty * back,
            ]);
        }
        return out;
    };
}

/* The last stretch, where the brush runs dry and its bristles part into
   filaments of uneven length. */
class DryTail {
    static MAX_GAP = 0.14;
    static POINT_LENGTH = 16;

    /** @param {Chance} r @param {Stroke} stroke @param {number} length */
    constructor(r, stroke, length) {
        this.dryFrom = stroke.length - length;
        this.bodyEnd = stroke.s.findIndex((s) => s >= this.dryFrom);
        const count = 3 + r.integer(3);
        const inner = Array.from({ length: count - 1 }, () =>
            r.between(-0.8, 0.8),
        ).sort((a, b) => a - b);
        this.bounds = [-1, ...inner, 1];
        /** @type {number[]} */
        this.reach = [];
        for (let b = 0; b < this.bounds.length - 1; b++) {
            const middle =
                Math.abs(nth(this.bounds, b) + nth(this.bounds, b + 1)) / 2;
            this.reach.push(stroke.length - r.between(0, 22) * (0.3 + middle));
        }
        this.innerGrain = this.bounds.map(() => grain(r, 3, stroke.length));
        this.r = chance(r.integer(2 ** 32));
    }

    /**
     * @param {Stroke} stroke
     * @param {number} i
     * @param {number} bound
     * @param {number} u
     * @param {number} dryness
     */
    rag(stroke, i, bound, u, dryness) {
        if (Math.abs(u) === 1)
            return nth(stroke.ragged[/** @type {Side} */ (u)], i);
        return nth(this.innerGrain, bound)(nth(stroke.s, i)) * 0.8 * dryness;
    }

    /** @param {Stroke} stroke @returns {Point[][]} */
    filaments(stroke) {
        const polygons = [];
        for (let b = 0; b < this.bounds.length - 1; b++) {
            const [loU, hiU] = [nth(this.bounds, b), nth(this.bounds, b + 1)];
            const reach = nth(this.reach, b);
            const lower = [];
            const upper = [];
            for (let i = this.bodyEnd - 3; i < stroke.s.length; i++) {
                const s = nth(stroke.s, i);
                if (s > reach) break;
                const dryness = smoothstep(this.dryFrom, stroke.length, s);
                const gap = (DryTail.MAX_GAP * dryness) / 2;
                const lo = loU + (loU > -1 ? gap : 0);
                const hi = hiU - (hiU < 1 ? gap : 0);
                const taper =
                    1 - smoothstep(reach - DryTail.POINT_LENGTH, reach, s);
                const mid = (lo + hi) / 2;
                const half = ((hi - lo) / 2) * taper;
                lower.push(
                    stroke.at(
                        i,
                        mid - half,
                        this.rag(stroke, i, b, loU, dryness),
                    ),
                );
                upper.push(
                    stroke.at(
                        i,
                        mid + half,
                        this.rag(stroke, i, b + 1, hiU, dryness),
                    ),
                );
            }
            polygons.push([...lower, ...upper.reverse()]);
        }
        return polygons;
    }

    /* Thin unpainted streaks inside the body, where the brush began to run
       dry before it split; returned as holes. */
    /** @param {Stroke} stroke @returns {Point[][]} */
    streaks(stroke) {
        const r = this.r;
        const last = nth(stroke.s, this.bodyEnd - 4);
        /** @type {[number, number, number][]} */
        const plans = this.bounds
            .slice(1, -1)
            .filter(() => r.odds(0.7))
            .map((u) => [
                u + r.between(-0.05, 0.05),
                last - r.between(15, 50),
                last,
            ]);
        for (let k = 1 + r.integer(2); k > 0; k--) {
            const end = r.between(last - 400, last);
            plans.push([r.between(-0.5, 0.5), end - r.between(30, 60), end]);
        }
        return plans
            .map(([u, start, end]) => {
                const thickness = r.between(0.04, 0.1);
                /** @type {Point[]} */
                const upper = [];
                /** @type {Point[]} */
                const lower = [];
                stroke.s.forEach((s, i) => {
                    if (s >= start && s <= end) {
                        const swell =
                            thickness *
                            Math.max(
                                Math.sin(
                                    (Math.PI * (s - start)) / (end - start),
                                ),
                                0,
                            ) **
                                0.7;
                        upper.push(stroke.at(i, u + swell));
                        lower.push(stroke.at(i, u - swell));
                    }
                });
                return [...upper, ...lower.reverse()];
            })
            .filter((hole) => hole.length > 4);
    }
}

/* Points every `step` units along a polyline. */
/** @param {Point[]} points @param {number} step */
function resample(points, step) {
    const out = [nth(points, 0)];
    let carried = 0;
    for (let k = 1; k < points.length; k++) {
        const p = nth(points, k - 1);
        const q = nth(points, k);
        const d = distance(p, q);
        let pos = step - carried;
        while (pos <= d) {
            out.push([
                p[0] + ((q[0] - p[0]) * pos) / d,
                p[1] + ((q[1] - p[1]) * pos) / d,
            ]);
            pos += step;
        }
        carried = d - (pos - step);
    }
    return out;
}

/* A polyline through `corners`, each inner corner filleted, sampled every unit. */
/** @param {Point[]} corners @param {number} radius */
function filleted(corners, radius) {
    const dense = [nth(corners, 0)];
    for (let i = 1; i < corners.length - 1; i++) {
        const [prev, corner, next] = [
            nth(corners, i - 1),
            nth(corners, i),
            nth(corners, i + 1),
        ];
        /** @type {(p: Point, q: Point) => Point} */
        const toward = (p, q) => {
            const d = distance(p, q);
            return [
                p[0] + ((q[0] - p[0]) * radius) / d,
                p[1] + ((q[1] - p[1]) * radius) / d,
            ];
        };
        const a = toward(corner, prev);
        const b = toward(corner, next);
        for (let j = 0; j <= 16; j++) {
            const t = j / 16;
            dense.push(
                /** @type {Point} */ (
                    [0, 1].map(
                        (d) =>
                            (1 - t) ** 2 * nth(a, d) +
                            2 * (1 - t) * t * nth(corner, d) +
                            t * t * nth(b, d),
                    )
                ),
            );
        }
    }
    dense.push(last(corners));
    return resample(dense, 1);
}

/* How far a stroke wanders and how rough its edges are, when nothing says. */
const FREE = { width: 19.5, drift: 3, grain: 0.6, bleed: 1.8 };

/* Ruled straighter than a free stroke: the hand wanders less off the line
   and the edges are calmer, so that two rules stay parallel. */
export const RULED = { drift: 0.8, grain: 0.35, bleed: 0.8 };

/* One stroke of the brush along `corners`, drawing on the chance `r`: as
   polygons of paint (`solids`) and the unpainted streaks inside them
   (`holes`). `width` is in units; `drift` is how far the hand wanders off the
   line, and `grain` and `bleed` how rough the edges are, so that lowering all
   three rules a straighter stroke. */
/**
 * @param {Chance} r
 * @param {Point[]} corners
 * @param {Partial<typeof FREE>} [style]
 * @returns {{ solids: Point[][], holes: Point[][] }}
 */
export function brushStroke(r, corners, style = {}) {
    const {
        width,
        drift: wander,
        grain: tooth,
        bleed: pooling,
    } = {
        ...FREE,
        ...style,
    };
    const base = filleted(corners, 16);
    const [baseS, baseN] = frame(base);
    const turns = corners.slice(1, -1).map((c) => {
        let best = 0;
        base.forEach((p, i) => {
            if (distance(p, c) < distance(nth(base, best), c)) best = i;
        });
        return nth(baseS, best);
    });
    const drift = wobble(r, 260);
    const points = base.map(([x, y], i) => {
        const [nx, ny] = nth(baseN, i);
        const off = wander * drift(nth(baseS, i));
        return /** @type {Point} */ ([x + nx * off, y + ny * off]);
    });

    const length = last(baseS);
    const dryTail = 140;
    const pressure = wobble(r, 260);
    const widthAt = (/** @type {number} */ s) => {
        let w = width * (1 + 0.16 * pressure(s));
        // Pressed down at the start, and into each turn.
        w *= 1 + 0.3 * Math.exp(-(((s - 16) / 14) ** 2));
        w *=
            1 +
            0.4 *
                Math.max(
                    0,
                    ...turns.map((c) => Math.exp(-(((s - c) / 16) ** 2))),
                );
        // The ink running low.
        w *= 1.06 - (0.16 * s) / length;
        return w * (1 - 0.35 * smoothstep(length - dryTail, length, s));
    };
    const stroke = new Stroke(
        points,
        widthAt,
        raggedEdges(r, length, tooth, pooling, length - dryTail),
    );
    const cap = startCap(r);
    const tail = new DryTail(r, stroke, dryTail);

    const body = [];
    for (let i = 0; i <= tail.bodyEnd; i++) body.push(stroke.edge(i, 1));
    for (let i = tail.bodyEnd; i >= 0; i--) body.push(stroke.edge(i, -1));
    body.push(...cap(stroke));
    return {
        solids: [body, ...tail.filaments(stroke)],
        holes: tail.streaks(stroke),
    };
}

/* — Writing it out — */

/* Ramer–Douglas–Peucker. */
/** @param {Point[]} points @param {number} tolerance */
function simplify(points, tolerance) {
    const keep = points.map(() => false);
    keep[0] = keep[points.length - 1] = true;
    /** @type {[number, number][]} */
    const stack = [[0, points.length - 1]];
    while (stack.length) {
        const [a, b] = last(stack);
        stack.pop();
        const [ax, ay] = nth(points, a);
        const [bx, by] = nth(points, b);
        const span = Math.hypot(bx - ax, by - ay) || 1e-9;
        let worst = -1;
        let worstD = tolerance;
        for (let i = a + 1; i < b; i++) {
            const [px, py] = nth(points, i);
            const d =
                Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / span;
            if (d > worstD) {
                worst = i;
                worstD = d;
            }
        }
        if (worst >= 0) {
            keep[worst] = true;
            stack.push([a, worst], [worst, b]);
        }
    }
    return points.filter((_, i) => keep[i]);
}

/** @type {(points: Point[]) => number} */
const signedArea = (points) =>
    points.reduce((sum, [x0, y0], i) => {
        const [x1, y1] = nth(points, (i + 1) % points.length);
        return sum + x0 * y1 - x1 * y0;
    }, 0) / 2;

/** @type {(v: number) => string} */
const num = (v) => v.toFixed(1).replace(/\.0$/, "");

/* SVG path data for paint and holes. Solids are wound one way, so that where
   they overlap they union under the nonzero rule, and holes the other. */
/** @param {Point[][]} solids @param {Point[][]} holes */
function pathData(solids, holes) {
    /** @type {(winding: number) => (polygon: Point[]) => [Point[], number]} */
    const wound = (winding) => (polygon) => [polygon, winding];
    return [...solids.map(wound(1)), ...holes.map(wound(-1))]
        .filter(([polygon]) => polygon.length > 2)
        .map(([polygon, winding]) => wound(winding)(simplify(polygon, 0.12)))
        .filter(([points]) => points.length > 2)
        .map(([points, winding]) => {
            if (signedArea(points) * winding < 0) points = points.reverse();
            return `M${points.map(([x, y]) => `${num(x)} ${num(y)}`).join(" ")}Z`;
        })
        .join("");
}

/** @type {(box: number[], d: string) => string} */
const svg = (box, d) =>
    svgOf(
        box.map(num).join(" "),
        `<path d='${d}'/>`,
        " preserveAspectRatio='none'",
    );

/* — Rules of unknown length — */

/* A line's length is not known until it is laid out, so a stroke for one is
   cut into three: its head, where the brush touched down; its body; and its
   tail, where it ran dry. The head and tail keep their shape at the ends of
   the line and only the body stretches between them. All three are cut from
   one drawing, so they meet without a seam.

   A stroke is drawn in a band 40 units across, the paint about half of that,
   running left to right or downward. Each end is three bands long. */
const BAND = 40;
const LENGTH = 1200;
const END = 3 * BAND;

/** @type {Record<"head" | "body" | "tail", [number, number]>} */
const PIECES = {
    head: [0, END],
    body: [END, LENGTH - END],
    tail: [LENGTH - END, LENGTH],
};

/* The part of `polygon` whose coordinate `k` lies between `lo` and `hi`
   (Sutherland–Hodgman, against the two sides of the slab). */
/**
 * @param {Point[]} polygon
 * @param {0 | 1} k
 * @param {number} lo
 * @param {number} hi
 */
function slab(polygon, k, lo, hi) {
    /** @type {(points: Point[], inside: (p: Point) => boolean, at: number) => Point[]} */
    const cut = (points, inside, at) =>
        points.flatMap((p, i) => {
            const q = nth(points, (i + 1) % points.length);
            const out = inside(p) ? [p] : [];
            if (inside(p) !== inside(q)) {
                const t = (at - p[k]) / (q[k] - p[k]);
                out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
            }
            return out;
        });
    return cut(
        cut(polygon, (p) => p[k] >= lo, lo),
        (p) => p[k] <= hi,
        hi,
    );
}

/* One piece of a stroke for a line, as an SVG to mask with, and its size in
   bands as a `box`: `axis` is `across` or `down`, `piece` is `head`,
   `body` or `tail`, and `ruled` draws it as straight as a frame's rules.
   Each piece carries only its own stretch of the stroke, cut a unit past its
   edges so that the cut never shows. */
/**
 * @param {object} stroke
 * @param {number | string} stroke.seed
 * @param {"across" | "down"} stroke.axis
 * @param {keyof typeof PIECES} stroke.piece
 * @param {boolean} [stroke.ruled]
 * @returns {{ svg: string, box: { x: number, y: number, w: number, h: number } }}
 */
export function strokePiece({ seed, axis, piece, ruled = false }) {
    const k = axis === "down" ? 1 : 0;
    /** @type {(a: number) => Point} */
    const along = (a) => (k ? [BAND / 2, a] : [a, BAND / 2]);
    const { solids, holes } = brushStroke(
        chance(seed),
        [along(30), along(LENGTH - 30)],
        ruled ? RULED : {},
    );
    const [lo, hi] = PIECES[piece];
    const crop = (/** @type {Point[]} */ polygon) =>
        slab(polygon, k, lo - 1, hi + 1);
    const d = pathData(solids.map(crop), holes.map(crop));
    /** @type {[number, number, number, number]} */
    const box = k ? [0, lo, BAND, hi - lo] : [lo, 0, hi - lo, BAND];
    const [w, h] = [box[2] / BAND, box[3] / BAND];
    return { svg: svg(box, d), box: { x: 0, y: 0, w, h } };
}

/* — Plates — */

/* The woodblock frame, brushed: a heavy stroke outside, as wide as the logo's
   hexagon, and a fine one inside it, with a channel of ground between; each
   as far in from the plate's edge as `inset` px, and carried `past` units
   beyond the corner where it ends. */
const PLATE = {
    outer: { inset: 7, width: 19.5, past: 34 },
    inner: { inset: 14, width: 6.5, past: 20 },
};

/* How far a plate's frame holds what it frames in from its edge, in px:
   clear of both rules and the channel between them. */
export const PLATE_PAD = 18;

/**
 * How long a plate is along a side, in px, that frames an image `length` px
 * long along it.
 *
 * @param {number} length
 */
export const plated = (length) => length + 2 * PLATE_PAD;

/* How many of the brush's units a px of plate is drawn in. */
const UNITS_PER_PX = 3.25;

/* A plate `width` by `height` px, ruled round in the brushed frame. Each rule
   is two strokes turned half about each other: across the top and down the
   right, then back along the foot and up the left, so that each corner where
   they cross holds one stroke's head and the other's dry tail. */
/**
 * @param {object} plate
 * @param {number} plate.width
 * @param {number} plate.height
 * @param {number | string} plate.seed
 * @returns {string}
 */
export function plate({ width, height, seed }) {
    const [W, H] = [width * UNITS_PER_PX, height * UNITS_PER_PX];
    const r = chance(seed);
    const strokes = Object.values(PLATE).flatMap(
        ({ inset, width: w, past }) => {
            const I = inset * UNITS_PER_PX;
            const style = { ...RULED, width: w };
            return [
                brushStroke(
                    r,
                    [
                        [I + 4, I],
                        [W - I, I + 1],
                        [W - I - 1, H - I + past],
                    ],
                    style,
                ),
                brushStroke(
                    r,
                    [
                        [W - I - 14, H - I],
                        [I, H - I - 1],
                        [I + 1, I - past],
                    ],
                    style,
                ),
            ];
        },
    );
    const d = pathData(
        strokes.flatMap((s) => s.solids),
        strokes.flatMap((s) => s.holes),
    );
    return svg([0, 0, W, H], d);
}

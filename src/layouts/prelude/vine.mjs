// @ts-check
/* A flowering vine drawn as a rule, after the vine-stem borders of
   illuminated manuscripts: one pen-drawn stem running left to right, steered
   by hand rather than by a wave, branching into spirals large and small, some
   holding a rose in the eye; ivy leaves on short stalks along every stem; and
   hairline tendrils curling wherever there is room.

   Everything is drawn in a fixed 40-unit-tall space, and the call site scales
   the whole drawing to its height, so the pen's weight, and the rim that
   gives the paint its edge, never depend on where it is drawn.
   Plain JS, so that Sass can call it while it compiles; see
   src/integrations/vines.ts. */

import { chance } from "./chance.mjs";
import { arcLengths, lerp, nth, smoothstep, svgOf, TAU } from "./pen.mjs";

/** @typedef {import("./chance.mjs").Chance} Chance */
/** @typedef {import("./pen.mjs").Point} Point */

/**
 * A path traced through points, measured along its length.
 *
 * @typedef {object} Traced
 * @property {Point[]} points
 * @property {number[]} lengths How far along it each point is.
 * @property {number} length
 * @property {(d: number) => { p: Point, θ: number }} at Where it is at
 *     distance `d` along it, and which way it is heading.
 */

/** How wide a stroke is at fraction `s` of its length. @typedef {(s: number, length: number) => number} Weight */

/** A disc of the page a growth occupies. @typedef {{ p: Point, r: number, free?: boolean }} Disc */

/** [x, y, width, height]. @typedef {[number, number, number, number]} Box */

/**
 * A drawing placed by a point on the vine, with the box it fills about that
 * point, in vine widths.
 *
 * @typedef {{ svg: string, box: { x: number, y: number, w: number, h: number } }} Placed
 */

/** The inks a drawing is painted in, by what they paint, and the page's own
    colour, which is the ground under them all. */
export const INKS = /** @type {const} */ ([
    "leaf",
    "flower",
    "iron",
    "pot",
    "ground",
]);

/** @typedef {(typeof INKS)[number]} Ink */

/** An ink a mark is painted in: any but the ground. @typedef {Exclude<Ink, "ground">} Pigment */

/** The two hands a mark is painted in: the pen's line, or a dab of the brush. @typedef {"line" | "dab"} Hand */

/** @typedef {{ ink: Pigment, hand: Hand, outlines: Point[][] }} Mark */

const H = 40;

/* — Geometry — */

/** @type {(p: Point, θ: number, r: number) => Point} */
const toward = ([x, y], θ, r) => [x + r * Math.cos(θ), y + r * Math.sin(θ)];

/* A path traced through points, measured so that anything can be placed on
   it by distance along it. Headings follow the chords between samples. */
/** @param {Point[]} points @returns {Traced} */
function trace(points) {
    const lengths = arcLengths(points);
    const length = nth(lengths, lengths.length - 1);
    /** @param {number} d */
    const at = (d) => {
        const x = Math.min(length, Math.max(0, d));
        let [i, j] = [0, points.length - 1];
        while (j - i > 1) {
            const m = (i + j) >> 1;
            if (nth(lengths, m) <= x) i = m;
            else j = m;
        }
        const [a, b] = [nth(points, i), nth(points, i + 1)];
        const [la, lb] = [nth(lengths, i), nth(lengths, i + 1)];
        const t = (x - la) / (lb - la || 1);
        return {
            p: /** @type {Point} */ ([
                lerp(a[0], b[0], t),
                lerp(a[1], b[1], t),
            ]),
            θ: Math.atan2(b[1] - a[1], b[0] - a[0]),
        };
    };
    return { points, lengths, length, at };
}

/* Walk from `start`, turning by `curl(s)` radians per unit at arc length s.
   A positive curl turns clockwise on the page. */
/**
 * @param {Point} start
 * @param {number} θ0
 * @param {number} length
 * @param {(s: number) => number} curl
 * @param {number} [step]
 */
function walk(start, θ0, length, curl, step = 0.6) {
    const points = [start];
    let [p, θ] = [start, θ0];
    for (let s = 0; s < length; s += step) {
        θ += curl(s) * step;
        p = toward(p, θ, step);
        points.push(p);
    }
    return points;
}

/* A scroll: a line that leaves its base along the heading θ, already bending
   by κ0 (the bend of whatever it grew from, so the join is smooth), and
   curls ever tighter in the direction `turn` (±1) until it has turned
   through `turns` revolutions. Returns the path, and the curvature it ends
   with, whose reciprocal is the radius of the scroll's eye. */
/**
 * @param {Point} base
 * @param {number} θ
 * @param {number} turn
 * @param {{ length: number, turns: number, κ0?: number, growth?: number }} shape
 */
function scroll(base, θ, turn, { length, turns, κ0 = 0, growth = 2 }) {
    const rise = ((turns * TAU - κ0 * length) * (growth + 1)) / length;
    const κ = (/** @type {number} */ s) => κ0 + rise * (s / length) ** growth;
    /* Walked finely, then kept only as finely as its curl needs. */
    const path = resample(
        trace(walk(base, θ, length, (s) => turn * κ(s), 0.25)),
        (s) => Math.min(3, Math.max(0.8, 1 / κ(s))),
    );
    return { path, κ: κ(length) };
}

/* The centre of the eye a scroll ends in, at distance `r` inside its last turn. */
/** @param {Traced} path @param {number} turn @param {number} r */
function eye(path, turn, r) {
    const { p, θ } = path.at(path.length);
    return toward(p, θ + (turn * Math.PI) / 2, r);
}

/* The outline of a stroke drawn along a path, `width(s)` across at fraction s
   of its length. A stroke that starts with a width starts with a round press. */
/**
 * @param {Traced} path
 * @param {(s: number) => number} width
 * @returns {Point[]}
 */
function ribbon(path, width) {
    const { points, lengths, length } = path;
    const n = points.length - 1;
    const heading = (/** @type {number} */ i) => {
        const [a, b] = [
            nth(points, Math.max(0, i - 1)),
            nth(points, Math.min(n, i + 1)),
        ];
        return Math.atan2(b[1] - a[1], b[0] - a[0]);
    };
    const side = (/** @type {number} */ sign) =>
        points.map((p, i) =>
            toward(
                p,
                heading(i) + (sign * Math.PI) / 2,
                width(nth(lengths, i) / length) / 2,
            ),
        );
    const press = width(0) / 2;
    const cap = [];
    if (press > 0.05) {
        const n = Math.max(2, Math.round(4 * press));
        for (let k = 1; k < n; k++)
            cap.push(
                toward(
                    nth(points, 0),
                    heading(0) + (3 * Math.PI) / 2 - (k / n) * Math.PI,
                    press,
                ),
            );
    }
    return [...side(1), ...side(-1).reverse(), ...cap];
}

/* Evenly spaced points along a path, `step(d)` apart, for an outline that is
   smooth without being heavier than it needs to be. */
/** @param {Traced} path @param {(d: number) => number} step */
function resample(path, step) {
    const points = [];
    for (let d = 0; d < path.length; d += step(d)) points.push(path.at(d).p);
    points.push(path.at(path.length).p);
    return trace(points);
}

/* An ellipse, its first axis along θ. */
/** @param {Point} centre @param {number} rx @param {number} ry @returns {Point[]} */
function oval([cx, cy], rx, ry, θ = 0) {
    const [c, s] = [Math.cos(θ), Math.sin(θ)];
    return Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * TAU;
        const [x, y] = [rx * Math.cos(a), ry * Math.sin(a)];
        return [cx + x * c - y * s, cy + x * s + y * c];
    });
}

/* A closed outline through the points, smoothed with Catmull-Rom splines.
   Written compactly, as relative moves in tenths of a unit, with the points
   rounded before they are differenced so that rounding never accumulates
   along a long stroke. */
/** @param {Point[]} points */
function closedPath(points) {
    const tenths = (/** @type {number} */ v) => Math.round(v * 10);
    const at = (/** @type {number} */ i) =>
        nth(points, (i + points.length) % points.length);
    const number = (/** @type {number} */ t) =>
        (t / 10).toString().replace(/^(-?)0\./, "$1.");
    const numbers = (/** @type {number[]} */ ts) =>
        ts.map(number).join(" ").replace(/ -/g, "-");
    let here = at(0).map(tenths);
    let d = `M${numbers(here)}c`;
    for (let i = 0; i < points.length; i++) {
        const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
        const c1 = [
            p1[0] + (p2[0] - p0[0]) / 6,
            p1[1] + (p2[1] - p0[1]) / 6,
        ].map(tenths);
        const c2 = [
            p2[0] - (p3[0] - p1[0]) / 6,
            p2[1] - (p3[1] - p1[1]) / 6,
        ].map(tenths);
        const to = p2.map(tenths);
        d +=
            (i ? " " : "") +
            numbers([...c1, ...c2, ...to].map((t, k) => t - nth(here, k % 2)));
        here = to;
    }
    return d.replace(/ -/g, "-") + "Z";
}

/* — The plant — */

/* Every mark is painted in one of the two inks and one of two hands: the
   pen's line, or a dab of the brush. A mark may be several overlapping
   outlines, which paint as one shape with one rim. */
/** @type {(ink: Pigment, hand: Hand, ...outlines: Point[][]) => Mark} */
const mark = (ink, hand, ...outlines) => ({ ink, hand, outlines });

/* How wide each kind of stem is drawn, at fraction s of its length: pen
   lines of nearly even weight, lightly tapered. The main stem has a slight
   press where the pen came down. */
/** @satisfies {Record<string, Weight>} */
const WEIGHT = {
    shoot: (s) => lerp(1.4, 0.75, s),
    stalk: (s) => lerp(0.8, 0.6, s),
    tendril: (s) => lerp(0.7, 0.32, s),
};

/* How the vine sits in its rule. A rule set flush left grows one way: the
   pen presses down at the start, the vine is full along its length, and the
   tip rolls up at the end. A centred rule is balanced: the stem thins toward
   both ends and rolls up alike at each, and the growth along it, its
   `vigour` at a given x, is fullest in the middle and dies away to either
   side. */
/**
 * @param {number} width
 * @param {boolean} centred
 * @returns {{ centred: boolean, weight: Weight, vigour: (x: number) => number }}
 */
function form(width, centred) {
    if (!centred) {
        return {
            centred,
            weight: (s, length) =>
                lerp(1.75, 1, smoothstep(0.6, 1, s)) +
                0.4 * Math.exp(-(((s * length - 1.5) / 3.5) ** 2)),
            vigour: () => 1,
        };
    }
    return {
        centred,
        weight: (s) => lerp(0.9, 1.75, Math.sin(Math.PI * s) ** 0.5),
        vigour: (x) =>
            Math.sin(Math.PI * Math.min(1, Math.max(0, x / width))) ** 1.4,
    };
}

/* The room left on the page: discs round everything drawn so far, kept in a
   grid, so that each new growth can look for space instead of piling onto
   the last. Growth must also stay inside the rule. */
/** @param {number} width */
function room(width) {
    const cell = 6;
    /** @type {Map<string, { x: number, y: number, r: number }[]>} */
    const grid = new Map();
    /** @type {(x: number, y: number) => string} */
    const key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
    /** @type {(p: Point, r: number) => boolean} */
    const inside = ([x, y], r) =>
        x - r > 0.5 && x + r < width - 0.5 && y - r > 1 && y + r < H - 1;
    /** @type {(p: Point, r: number) => boolean} */
    const clear = ([x, y], r) => {
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                for (const d of grid.get(key(x + i * cell, y + j * cell)) ??
                    []) {
                    if (Math.hypot(d.x - x, d.y - y) < d.r + r) return false;
                }
            }
        }
        return true;
    };
    return {
        /* Discs may skip the room check (`free`) where a growth joins what
           it grew from, but never the edges of the rule. */
        fits: (/** @type {Disc[]} */ discs) =>
            discs.every(
                ({ p, r, free }) => inside(p, r) && (free || clear(p, r)),
            ),
        claim: (/** @type {Disc[]} */ discs) => {
            for (const { p, r } of discs) {
                const k = key(...p);
                const held = grid.get(k) ?? [];
                grid.set(k, held);
                held.push({ x: p[0], y: p[1], r });
            }
        },
    };
}

/* The space a curl encloses, as a disc about the middle of its coils: the
   eye of a curl is part of the curl, and nothing else may grow into it. A
   spiral's eye is in its later coils, from `from` of the way along; a loop's
   is the whole loop. */
/** @param {Point[]} points @returns {Disc} */
function hollow(points, from = 0.35) {
    const coil = points.slice(Math.floor(points.length * from));
    const c = /** @type {Point} */ (
        [0, 1].map(
            (k) => coil.reduce((sum, p) => sum + nth(p, k), 0) / coil.length,
        )
    );
    const distances = coil
        .map(([x, y]) => Math.hypot(x - c[0], y - c[1]))
        .sort((a, b) => a - b);
    return {
        p: c,
        r: 0.85 * nth(distances, Math.floor(distances.length / 2)),
    };
}

/* How far a curl runs beside its parent, in units, before the two are clear
   of each other. */
const CLEAR = 8;

/* The discs a stroke occupies, one a unit along it, with a margin of paper.
   The first `joint` units, where it leaves its parent, are free: a growth
   that leaves along its parent's tangent runs beside it for a while before
   the two are clear of each other. */
/** @param {Traced} path @param {Weight} weight @returns {Disc[]} */
function discs(path, weight, joint = 0, margin = 0.6) {
    const out = [];
    for (let d = 0; d <= path.length; d += 1) {
        out.push({
            p: path.at(d).p,
            r: weight(d / path.length, path.length) / 2 + margin,
            free: d < joint,
        });
    }
    return out;
}

/* An ivy leaf: three pointed lobes, the middle one longest, on a heart-shaped
   base. Points are repeated at the tips so the spline comes to a point. */
/** @type {Point[]} */
const IVY = [
    [0.06, 0],
    [0.04, -0.14],
    [0.14, -0.32],
    [0.3, -0.47],
    [0.3, -0.47],
    [0.4, -0.3],
    [0.52, -0.19],
    [0.78, -0.12],
    [1, 0],
    [1, 0],
    [0.78, 0.12],
    [0.52, 0.19],
    [0.4, 0.3],
    [0.3, 0.47],
    [0.3, 0.47],
    [0.14, 0.32],
    [0.04, 0.14],
];
/** @param {Point} base @param {number} θ @param {number} size @returns {Point[]} */
function ivy(base, θ, size) {
    const [c, s] = [Math.cos(θ), Math.sin(θ)];
    return IVY.map(([x, y]) => [
        base[0] + size * (x * c - y * s),
        base[1] + size * (x * s + y * c),
    ]);
}

/* A small rose: five round petals about an open eye. */
/** @type {(c: Point, radius: number, θ: number) => Point[][]} */
const rose = (c, radius, θ) =>
    Array.from({ length: 5 }, (_, i) =>
        oval(
            toward(c, θ + (i * TAU) / 5, 0.56 * radius),
            0.45 * radius,
            0.45 * radius,
        ),
    );

/* The main stem, one continuous pen line from left to right, steered like a
   hand drawing it: a run of gentle arcs, each bending back toward the middle
   of the rule through a different angle and at a different radius, never
   steeper than about a third of a right angle; now and then, near the
   middle, a loop that crosses itself; and at the end a spiral. A centred
   rule starts with a spiral too. Returns the path, and the stretch of it,
   between the spirals, that runs along the rule. */
/** @param {number} width @param {Chance} r @param {{ centred: boolean }} form */
function mainStem(width, r, { centred }) {
    /** @type {Point[]} */
    const points = [
        [centred ? r.between(13, 17) : 2.5, H / 2 + r.between(-2, 2)],
    ];
    let θ = r.between(-0.15, 0.15);
    const θ0 = θ;
    const step = 0.5;
    const steep = 0.5;
    const end = width - r.between(20, 26);
    const hollows = [];
    let loops = Math.max(0, Math.round(width / 240 + r.between(-0.6, 0.5)));
    const here = () => nth(points, points.length - 1);
    const advance = () => points.push(toward(here(), θ, step));
    /* Which way to turn to come back toward the middle, judged a little way
       ahead along the current heading. */
    const drift = () => here()[1] - H / 2 + 8 * Math.sin(θ);
    const homeward = () => (drift() > 0 ? -1 : 1);

    while (here()[0] < end) {
        if (
            loops > 0 &&
            here()[0] > 30 &&
            here()[0] < end - 30 &&
            Math.abs(drift()) < 3 &&
            r.odds(0.25)
        ) {
            loops--;
            const from = points.length;
            /* A teardrop rather than a ring: the pen turns gently into the
               loop, hard round its far end, and gently out across itself. */
            const [turn, κ] = [r.sign(), r.between(0.13, 0.17)];
            const total = TAU * r.between(1, 1.05);
            for (let turned = 0; turned < total; ) {
                const κt =
                    κ * (0.35 + 1.3 * Math.sin((Math.PI * turned) / total));
                θ += turn * κt * step;
                turned += κt * step;
                advance();
            }
            θ = Math.atan2(Math.sin(θ), Math.cos(θ));
            hollows.push(hollow(points.slice(from), 0));
            continue;
        }
        /* Near the middle the hand may wander either way; away from it, it
           always comes back. */
        const far = Math.abs(here()[1] - H / 2) > 4;
        const turn =
            !far && Math.abs(drift()) < 2.5 && r.odds(0.35)
                ? -homeward()
                : homeward();
        const κ = turn * (far ? r.between(0.07, 0.1) : r.between(0.025, 0.065));
        const angle = r.between(0.3, 1);
        /* An arc ends early if it would climb too steeply, or if it is
           bending away from the middle and has carried the stem too far. */
        const outward = turn !== homeward();
        const away = () => outward && Math.abs(here()[1] - H / 2) > 3.5;
        for (let turned = 0; turned < angle; turned += Math.abs(κ) * step) {
            const next = θ + κ * step;
            if (
                (Math.abs(next) > steep && Math.abs(next) > Math.abs(θ)) ||
                away()
            )
                break;
            θ = next;
            advance();
        }
        advance();
    }
    /* An end rolls up toward the middle, as large as the room left allows.
       The start's spiral is drawn outward from the first point, heading
       back, then reversed, so the pen comes out of the curl into the stem. */
    const within = (/** @type {{ path: Traced }} */ { path }) =>
        path.points.every(
            ([x, y]) => x > 1.5 && x < width - 1.5 && y > 1.5 && y < H - 1.5,
        );
    /** @type {(from: Point, heading: number, turn: number) => Point[]} */
    const curl = (from, heading, turn) => {
        const spiral = { turns: r.between(1.15, 1.45), κ0: 0.04, growth: 1.3 };
        const sizes = centred ? [14, 11, 8, 6] : [20, 16, 12, 9, 6];
        return (
            sizes
                .map((length) =>
                    scroll(from, heading, turn, { ...spiral, length }),
                )
                .find(within) ??
            scroll(from, heading, turn, { ...spiral, length: 4 })
        ).path.points;
    };
    const tip = curl(here(), θ, homeward());
    const start = nth(points, 0);
    const [x0, y0] = start;
    const head = centred
        ? curl(start, θ0 + Math.PI, y0 > H / 2 ? 1 : -1)
        : null;
    const tail = head ? [...head].reverse() : [start];
    const path = resample(
        trace([...tail, ...points.slice(1), ...tip.slice(1)]),
        () => 2,
    );
    const along = (/** @type {number} */ x) =>
        path.lengths[path.points.findIndex(([px]) => px >= x)] ?? path.length;
    return {
        path,
        span: /** @type {[number, number]} */ ([along(x0), along(here()[0])]),
        hollows: [
            ...hollows,
            ...[tip, head].flatMap((points) =>
                points ? [hollow(points)] : [],
            ),
        ],
    };
}

/* The whole vine: the main stem, then, in order of size, what grows from it
   wherever there is room. Shoots spiral off along the stem's tangent, large
   and open or small and tight; a large one may hold a rose in its eye, or end
   in a leaf. Ivy leaves on short stalks follow the stems at varied angles,
   and hairline tendrils off the main stem fill what gaps are left. Curls grow
   only from the main stem, never from one another. */
/**
 * @param {number} width
 * @param {Chance} r
 * @param {ReturnType<typeof form> & { blooms: boolean }} form
 * @returns {Mark[]}
 */
function grow(width, r, { weight, vigour, centred, blooms }) {
    const space = room(width);
    /** @type {Mark[]} */
    const marks = [];
    /** @type {{ path: Traced, weight: Weight }[]} */
    const stems = [];

    /* Paint the marks if the discs they occupy are free, and take the room. */
    /** @type {(occupied: Disc[], ...painted: Mark[]) => boolean} */
    const place = (occupied, ...painted) => {
        if (!space.fits(occupied)) return false;
        space.claim(occupied);
        marks.push(...painted);
        return true;
    };
    /** @type {(path: Traced, weight: Weight) => Mark} */
    const line = (path, weight) =>
        mark(
            "leaf",
            "line",
            ribbon(path, (s) => weight(s, path.length)),
        );
    /**
     * @typedef {{ discs: Disc[], mark: Mark | null }} Growth
     * @type {(path: Traced, weight: Weight, joint: number, ...more: Growth[]) => boolean}
     */
    const stem = (path, weight, joint, ...more) => {
        const placed = place(
            [...discs(path, weight, joint), ...more.flatMap((m) => m.discs)],
            line(path, weight),
            ...more.flatMap((m) => (m.mark ? [m.mark] : [])),
        );
        if (placed) stems.push({ path, weight });
        return placed;
    };
    /* A curl is a stem that also holds the space inside its coils. */
    /** @type {(path: Traced, weight: Weight, ...more: Growth[]) => boolean} */
    const curl = (path, weight, ...more) =>
        stem(
            path,
            weight,
            CLEAR,
            { discs: [hollow(path.points)], mark: null },
            ...more,
        );

    const { path: main, span, hollows } = mainStem(width, r, { centred });
    space.claim([...discs(main, weight), ...hollows]);
    marks.push(line(main, weight));
    stems.push({ path: main, weight });
    /* How strongly the vine grows where a growth would leave its stem. */
    const strength = (/** @type {Traced} */ path, /** @type {number} */ d) =>
        vigour(path.at(d).p[0]);

    /* A leaf at the end of a short stalk, off a stem at distance d. */
    /** @type {(path: Traced, d: number, side: number) => boolean} */
    const sprig = (path, d, side) => {
        const { p, θ } = path.at(d);
        const angle = side * r.between(0.6, 1.25);
        const length = r.between(1.6, 3);
        const size = r.between(4.6, 6.4) * lerp(0.75, 1, strength(path, d));
        const turn = r.between(-0.35, 0.35);
        const { stalk, leaf, marks } = stalkedLeaf(p, θ + angle, length, size, {
            side,
            step: 0.8,
            turn,
        });
        const blade = {
            p: toward(leaf.p, leaf.θ, 0.45 * size),
            r: 0.42 * size + 0.4,
        };
        return place(
            [...discs(stalk, WEIGHT.stalk, Infinity), blade],
            ...marks,
        );
    };

    const roseBudget = Math.max(1, Math.round(width / 70));
    let roses = 0;
    /** @type {(c: Point, radius: number) => Growth | null} */
    const bloom = (c, radius) => {
        if (!blooms || roses >= roseBudget) return null;
        return {
            discs: [{ p: c, r: radius + 0.3 }],
            mark: mark("flower", "dab", ...rose(c, radius, r.between(0, TAU))),
        };
    };

    /* Shoots off the main stem, mostly alternating sides. */
    let side = r.sign();
    for (
        let d = span[0] + r.between(10, 18);
        d < span[1] - 6;
        d += r.between(12, 24)
    ) {
        side = r.odds(0.75) ? -side : side;
        const { p, θ } = main.at(d);
        const v = vigour(p[0]);
        if (!r.odds(0.3 + 0.7 * v)) continue;
        const large = r.odds(0.5 * v);
        const shape = large
            ? {
                  length: r.between(26, 40) * lerp(0.7, 1, v),
                  turns: r.between(1.05, 1.4),
                  κ0: 0.07,
                  growth: 0.9,
              }
            : {
                  length: r.between(10, 17),
                  turns: r.between(1.2, 1.7),
                  κ0: 0.09,
                  growth: 1.4,
              };
        /* Where a shoot has no room it grows smaller, but never so small
           that its curl knots up against the stem. */
        for (const shrink of [1, 0.7, 0.5].filter(
            (k) => shape.length * k >= 10,
        )) {
            const { path, κ } = scroll(p, θ + side * 0.2, side, {
                ...shape,
                length: shape.length * shrink,
            });
            /* A large shoot ends in a rose if it can: in the eye of its
               curl when that is wide enough, or else just past its tip. */
            const eyeRadius = 1 / κ;
            const end = path.at(path.length);
            const crowns =
                !large || !r.odds(0.8 * v)
                    ? []
                    : [
                          eyeRadius > 3.2
                              ? bloom(
                                    eye(path, side, eyeRadius),
                                    Math.min(4.4, eyeRadius - 0.6),
                                )
                              : null,
                          bloom(toward(end.p, end.θ, 3.3), 3.2),
                      ].flatMap((crown) => (crown ? [crown] : []));
            const crowned = crowns.some((crown) =>
                curl(path, WEIGHT.shoot, crown),
            );
            if (crowned) roses++;
            if (!crowned && !curl(path, WEIGHT.shoot)) continue;
            if (large && !crowned) sprig(path, path.length, side);
            break;
        }
    }

    /* Ivy along the main stem and the shoots. */
    for (const { path, weight } of [...stems]) {
        if (weight === WEIGHT.tendril) continue;
        let leafSide = r.sign();
        for (
            let d = r.between(3, 7);
            d < path.length - 3;
            d += r.between(6, 12)
        ) {
            leafSide = r.odds(0.7) ? -leafSide : leafSide;
            if (r.odds(0.35 + 0.65 * strength(path, d)))
                sprig(path, d, leafSide);
        }
    }

    /* If no rose found a curl to sit in, one grows on a stalk of its own. */
    for (let tries = 0; blooms && roses === 0 && tries < 40; tries++) {
        const { p, θ } = main.at(lerp(...span, r.between(0.25, 0.75)));
        const s = r.sign();
        const stalk = trace(
            walk(p, θ + s * 0.9, r.between(4, 6), () => s * 0.1, 1),
        );
        const end = stalk.at(stalk.length);
        const crown = bloom(toward(end.p, end.θ, 3.4), 3.3);
        if (crown && stem(stalk, WEIGHT.stalk, CLEAR, crown)) roses++;
    }

    /* Hairline tendrils in the gaps, from the main stem only: a curl never
       grows from another curl. */
    for (let i = 0; i < Math.round(width / 12); i++) {
        const at = main.at(lerp(...span, r.between(0, 1)));
        if (!r.odds(vigour(at.p[0]))) continue;
        const turn = r.sign();
        const tendril = scroll(at.p, at.θ + turn * 0.35, turn, {
            length: r.between(9, 15),
            turns: r.between(1, 1.5),
            κ0: 0.06,
            growth: 2.2,
        });
        curl(tendril.path, WEIGHT.tendril);
    }

    return marks;
}

/* — The paint — */

/* Water carries pigment to the wet edge and leaves it there as it dries: a
   dab keeps full strength at its rim, `RIM` wide, while its interior thins
   to a wash of `WASH` ink on the ground. A line is too narrow to have an
   interior, and is solid.

   The rim is stroked under the wash, which is opaque, so that the wash
   covers the inner half of the stroke. Where a dab's outlines overlap, as a
   rose's petals do, only their outer edge keeps a rim.

   Only fills and strokes, never SVG filters: a browser readies its GPU for
   each filter the first time it draws one, and the page stalls while it does. */
const RIM = 1;
const WASH = 0.55;

/** `ink` at `strength` on `ground`, as one opaque colour. Both are `#rrggbb`. */
/** @type {(ink: string, ground: string, strength: number) => string} */
function onGround(ink, ground, strength) {
    const rgb = (/** @type {string} */ hex) =>
        [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const [a, b] = [rgb(ink), rgb(ground)];
    return `#${a
        .map((v, k) => Math.round(lerp(nth(b, k), v, strength)))
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")}`;
}

/** @type {Record<Hand, (ink: string, ground: string) => string>} */
const HANDS = {
    line: (ink) => `fill='${ink}'`,
    dab: (ink, ground) =>
        `fill='${onGround(ink, ground, WASH)}' stroke='${ink}' stroke-width='${RIM}' stroke-linejoin='round' paint-order='stroke'`,
};

/* Marks painted as an SVG over `box`, [x, y, width, height] in units. Each
   ink and hand is one path: the plate under everything, then iron, then
   lines, leaves, and flowers on top. Growth never lets two marks of a layer
   overlap, so painting them as one shape changes nothing. */
/**
 * @param {Mark[]} marks
 * @param {Box} box
 * @param {Partial<Record<Pigment, string>> & { ground: string }} inks
 */
function picture(marks, box, inks) {
    /** @type {[Pigment, Hand][]} */
    const layers = [
        ["pot", "dab"],
        ["iron", "line"],
        ["leaf", "line"],
        ["leaf", "dab"],
        ["flower", "dab"],
    ];
    const paint = (/** @type {[Pigment, Hand]} */ [which, hand]) => {
        const outlines = marks
            .filter((m) => m.ink === which && m.hand === hand)
            .flatMap((m) => m.outlines);
        if (!outlines.length) return "";
        const ink = inks[which];
        if (!ink) throw new Error(`${which} was drawn without its ink.`);
        return `<path d='${outlines.map(closedPath).join("")}' ${HANDS[hand](ink, inks.ground)}/>`;
    };
    const viewBox = box.map((v) => +v.toFixed(3)).join(" ");
    return svgOf(viewBox, layers.map(paint).join(""));
}

/* Marks moved by [dx, dy], or turned a quarter clockwise, so that a vine
   grown left to right grows down the page instead. */
/** @type {(marks: Mark[], by: Point) => Mark[]} */
const moved = (marks, [dx, dy]) =>
    reshaped(marks, ([x, y]) => [x + dx, y + dy]);
/** @type {(marks: Mark[]) => Mark[]} */
const turned = (marks) => reshaped(marks, ([x, y]) => [H - y, x]);
/** @type {(marks: Mark[], f: (p: Point) => Point) => Mark[]} */
const reshaped = (marks, f) =>
    marks.map((m) => ({ ...m, outlines: m.outlines.map((o) => o.map(f)) }));

/**
 * A vine `ratio` times as wide as it is tall, as the markup of an SVG. The
 * same arguments always draw the same vine.
 *
 * @param {object} vine
 * @param {number} vine.ratio Its width over its height.
 * @param {number} vine.seed Which vine of that shape.
 * @param {boolean} vine.centred Whether it is centred in its column, and so
 *     tapers to both ends, or set flush left and grows one way.
 * @param {string} vine.leaf The colour of stem, leaf and tendril.
 * @param {string} vine.flower The colour of the roses.
 * @param {string} vine.ground The page's own colour, which the paint thins
 *     toward.
 * @param {boolean} [vine.upright] Whether it grows down the page rather than
 *     across it, its ratio then being its height over its width.
 * @param {boolean} [vine.blooms] Whether it bears roses.
 * @returns {string}
 */
export function vine({
    ratio,
    seed,
    centred,
    leaf,
    flower,
    ground,
    upright = false,
    blooms = true,
}) {
    const width = ratio * H;
    const r = chance(seed);
    const marks = grow(width, r, { ...form(width, centred), blooms });
    return picture(
        upright ? turned(marks) : marks,
        upright ? [0, 0, H, width] : [0, 0, width, H],
        { leaf, flower, ground },
    );
}

/* — The table of contents —

   A section of the contents grows a vine of its own down beside its entries,
   from a shoot hung over an iron ring beside its heading. Each second-level
   entry is marked on that vine by a leaf with a rose on it, and each
   third-level entry is reached by a shoot of its own. Everything is drawn for
   a vine on the left of its words; a column on their right shows it mirrored.

   The pieces are measured in widths of the section's vine, so that the
   stylesheet can set them out at any size. A piece that has to be placed is
   drawn about a point on the vine, and its `box` says where the drawing lies
   around that point. */

/* Where an upright vine's stem starts across its column, in units: the first
   thing its stem draws by chance is how far off the middle it starts. */
/** @param {number} seed */
const vineStart = (seed) => H / 2 - chance(seed).between(-2, 2);

/**
 * A leaf at the end of a short stalk, `stalk` units long from `p`, heading
 * `θ`: its marks, the stalk's path, and the leaf's base and heading.
 *
 * @param {Point} p
 * @param {number} θ
 * @param {number} stalk
 * @param {number} size
 * @param {object} [how]
 * @param {number} [how.side] Which way the stalk curls, as a scroll turns.
 * @param {number} [how.step] How finely the stalk is drawn.
 * @param {number} [how.turn] How far the leaf turns off the stalk's end.
 */
function stalkedLeaf(
    p,
    θ,
    stalk,
    size,
    { side = 1, step = 0.5, turn = 0 } = {},
) {
    const path = trace(walk(p, θ, stalk, () => side * 0.08, step));
    const end = path.at(path.length);
    const heading = end.θ + turn;
    return {
        stalk: path,
        leaf: { p: end.p, θ: heading },
        marks: [
            mark("leaf", "line", ribbon(path, WEIGHT.stalk)),
            mark("leaf", "dab", ivy(end.p, heading, size)),
        ],
    };
}

/* The box round some marks, `pad` units clear of them. */
/** @param {Mark[]} marks @param {number} pad @returns {Box} */
function boxOf(marks, pad) {
    const all = marks.flatMap((m) => m.outlines.flat());
    const xs = all.map((p) => p[0]);
    const ys = all.map((p) => p[1]);
    const [x, y] = [Math.min(...xs) - pad, Math.min(...ys) - pad];
    return [x, y, Math.max(...xs) + pad - x, Math.max(...ys) + pad - y];
}

/* A drawing, with the box it fills measured in vine widths. */
/** @type {(svg: string, box: Box) => Placed} */
const placed = (svg, [x, y, w, h]) => ({
    svg,
    box: { x: x / H, y: y / H, w: w / H, h: h / H },
});

/**
 * A section's vine, grown down beside its entries, with no roses of its own
 * so that every rose on it marks an entry.
 *
 * @param {object} vine
 * @param {number} vine.ratio Its length over its width.
 * @param {number} vine.seed Which vine of that length. The hanging shoot it
 *     grows from is drawn with the same seed, so that the two meet.
 * @param {string} vine.leaf The colour of stem, leaf and tendril.
 * @param {string} vine.ground The page's own colour.
 * @returns {string}
 */
export function tocVine({ ratio, seed, leaf, ground }) {
    return vine({
        ratio,
        seed,
        leaf,
        flower: leaf,
        ground,
        centred: false,
        upright: true,
        blooms: false,
    });
}

/**
 * A shoot off a section's vine, out to a third-level entry: it leaves the
 * stem heading down along it, rounds an elbow, and runs toward the words,
 * ending in a curl. Drawn about the point on the stem where the elbow begins,
 * so the run is level with a point `radius` below it.
 *
 * @param {object} shoot
 * @param {number} shoot.reach How far toward the words it may reach, curl
 *     and all, in vine widths.
 * @param {number} shoot.radius The elbow's radius, in vine widths.
 * @param {number} shoot.seed Which shoot of that shape.
 * @param {string} shoot.leaf The colour of stem and leaf.
 * @param {string} shoot.ground The page's own colour.
 * @returns {{ svg: string, box: { x: number, y: number, w: number, h: number } }}
 */
export function shoot({ reach, radius, seed, leaf, ground }) {
    const r = chance(seed);
    const bend = radius * H;
    /* How far past the end of its run the closing curl reaches. */
    const curlReach = 7;
    const run = reach * H - bend - curlReach;
    const lead = 3;
    const elbow = (Math.PI / 2) * bend;
    const wave = r.between(0.03, 0.05) * r.sign();
    const steer = (/** @type {number} */ d) =>
        d < lead
            ? 0
            : d < lead + elbow
              ? -1 / bend
              : wave * Math.cos((d - lead - elbow) / 5);
    const stem = walk([0, -lead], Math.PI / 2, lead + elbow + run, steer, 0.25);
    const end = trace(stem).at(trace(stem).length);
    const { path: coil } = scroll(end.p, end.θ, -1, {
        length: r.between(15, 20),
        turns: r.between(1.2, 1.5),
        κ0: 0.04,
        growth: 1.4,
    });
    const path = resample(trace([...stem, ...coil.points.slice(1)]), () => 0.8);
    const marks = [
        mark(
            "leaf",
            "line",
            ribbon(path, (f) => lerp(1.7, 0.55, f)),
        ),
    ];

    /* A leaf or two along the run, on short stalks, either side. */
    let side = r.sign();
    const count = Math.floor(run / 10);
    for (let k = 0; k < count; k++) {
        const d =
            lead +
            elbow +
            run * ((k + 0.6) / (count + 0.4)) +
            r.between(-1.5, 1.5);
        const { p, θ } = path.at(d);
        const angle = side * r.between(0.7, 1.1);
        const length = r.between(1.6, 2.4);
        const turn = r.between(-0.3, 0.3);
        const size = r.between(5.5, 7);
        marks.push(
            ...stalkedLeaf(p, θ + angle, length, size, {
                side,
                step: 0.6,
                turn,
            }).marks,
        );
        side = -side;
    }

    const box = boxOf(marks, 1.5);
    return placed(picture(marks, box, { leaf, ground }), box);
}

/**
 * The mark on a section's vine beside a second-level entry: a large ivy leaf
 * on a short stalk, reaching from the stem toward the words, with a rose set
 * in the middle of its blade. Twice the size of the vine's own leaves, so it
 * reads as a mark rather than foliage. Drawn about the point on the stem it
 * grows from.
 *
 * @param {object} blossom
 * @param {number} blossom.seed Which blossom.
 * @param {string} blossom.leaf The colour of stalk and leaf.
 * @param {string} blossom.flower The colour of the rose.
 * @param {string} blossom.ground The page's own colour.
 * @returns {{ svg: string, box: { x: number, y: number, w: number, h: number } }}
 */
export function blossom({ seed, leaf, flower, ground }) {
    const r = chance(seed);
    const size = 15;
    const stalk = trace(walk([-1.5, 0], 0.55, 4, () => 0.05, 0.4));
    const end = stalk.at(stalk.length);
    const blade = end.θ + r.between(-0.1, 0.1);
    const petals = rose(
        toward(end.p, blade, 0.42 * size),
        4.6,
        r.between(0, TAU),
    );
    const marks = [
        mark(
            "leaf",
            "line",
            ribbon(stalk, (f) => lerp(1.6, 1.1, f)),
        ),
        mark("leaf", "dab", ivy(end.p, blade, size)),
        mark("flower", "dab", ...petals),
    ];
    const box = boxOf(marks, 1.5);
    return placed(picture(marks, box, { leaf, flower, ground }), box);
}

/* One frame of a hanging shoot, `w` by `h` units, with the column its
   section's vine grows down starting `x` units in from the frame's left. */
const COIL = { w: 64, h: 58, x: 12, frames: 12 };
/* Where the hanging stem's shoots leave it, in units below the ring; a
   positive side is away from the words. */
const HANGING_SHOOTS = [
    { from: 13, kind: "tendril", side: 1 },
    { from: 22, kind: "leaf", side: -1 },
];

/**
 * What a section's vine grows from, beside its heading, as a strip of frames
 * from folded to open: an iron ring on a bolt from a square plate, with a
 * shoot draped over it, hanging down the vine's column. Folded, its end is
 * curled tight. As the section opens the curl unrolls downward, swaying a
 * little and putting out two shoots, and runs on into where the section's
 * vine begins, so everything moves the way the reader does, down the page.
 *
 * Drawn about the top of the section vine's column, at its middle. The box
 * is one frame's.
 *
 * @param {object} hanging
 * @param {number} hanging.seed The seed of the section vine it hangs into.
 * @param {number} hanging.rise How far above the top of the section's vine
 *   the ring is hung, in widths of the vine: where it reads as level with its
 *   heading's line.
 * @param {string} hanging.leaf The colour of stem and leaf.
 * @param {string} hanging.iron The colour of the ring and bolt.
 * @param {string} hanging.pot The colour of the plate.
 * @param {string} hanging.ground The page's own colour.
 * @returns {{ svg: string, box: { x: number, y: number, w: number, h: number }, frames: number }}
 */
export function hanging({ seed, rise, leaf, iron, pot, ground }) {
    /** @type {Point} */
    const base = [vineStart(seed) + COIL.x, COIL.h + 0.5];
    /* How far round the ring the shoot passes as it comes over it. */
    const R = 6.4;
    /* Level with the heading's line, with the vine's column on its far side,
       so the shoot drops from it straight down that column. */
    /** @type {Point} */
    const centre = [base[0] - R, COIL.h - rise * H];

    /* The ring, the same in every frame. */
    const radius = 4.8;
    const top = toward(centre, -Math.PI / 2, radius);
    /** @type {Point} */
    const plate = [centre[0], top[1] - 6];
    const half = 3.4;
    const ring = trace(
        Array.from({ length: 41 }, (_, i) =>
            toward(centre, -Math.PI / 2 + (i / 40) * TAU, radius),
        ),
    );
    const held = [
        mark("pot", "dab", [
            [plate[0] - half, plate[1] - half],
            [plate[0], plate[1] - half - 0.1],
            [plate[0] + half, plate[1] - half],
            [plate[0] + half + 0.1, plate[1]],
            [plate[0] + half, plate[1] + half],
            [plate[0], plate[1] + half + 0.1],
            [plate[0] - half, plate[1] + half],
            [plate[0] - half - 0.1, plate[1]],
        ]),
        mark(
            "iron",
            "line",
            ribbon(trace([plate, [top[0], top[1] + 0.4]]), () => 1.3),
        ),
        mark(
            "iron",
            "line",
            ribbon(ring, () => 1.5),
        ),
    ];

    /* Up the near side of the ring, over it, and down: a tucked end, then
       half a turn round it. */
    const tuck = 3;
    const lead = tuck + Math.PI * R;
    /** @type {Point} */
    const start = [centre[0] - R, centre[1] + tuck];
    const hang = { curled: 6, open: base[1] - centre[1] };
    const curl = { curled: 52, open: 5, turns: 1.15, growth: 0.5 };
    /* The hanging stem sways, as the vine's own stem does: one S-bend over
       its full drop, so that it leaves the ring and reaches the vine both
       heading straight down the column. */
    const sway = chance(seed + 2).between(0.22, 0.32) * chance(seed + 3).sign();
    const wave = (/** @type {number} */ t) =>
        t < hang.open
            ? sway * (TAU / hang.open) * Math.cos((TAU * t) / hang.open)
            : 0;

    /** @type {Mark[]} */
    const marks = [];
    for (let k = 0; k < COIL.frames; k++) {
        const f = smoothstep(0, 1, k / (COIL.frames - 1));
        const r = chance(seed);
        const down = lerp(hang.curled, hang.open, f);
        const tip = lerp(curl.curled, curl.open, f);
        const turns = curl.turns * (1 - f);
        const length = lead + down + tip;
        const steer = (/** @type {number} */ s) => {
            if (s < tuck) return 0;
            if (s < lead) return 1 / R;
            if (s < lead + down) return wave(s - lead);
            const u = (s - lead - down) / tip;
            return (
                wave(s - lead) +
                ((turns * TAU * (curl.growth + 1)) / tip) * u ** curl.growth
            );
        };
        const path = resample(
            trace(walk(start, -Math.PI / 2, length, steer, 0.25)),
            () => 0.8,
        );
        /* Fine at the tucked end, full where it hangs, and at the bottom thin
           while it is a curled tip, or as heavy as the vine's own start once
           it runs on into it. */
        const hung = lead / length;
        const end = lerp(0.7, 2.0, f);
        const weight = (/** @type {number} */ s) =>
            s < hung
                ? lerp(0.9, 1.7, s / hung)
                : lerp(1.7, end, (s - hung) / (1 - hung));
        const at = path.at(lead + 3);
        const frame = [
            mark("leaf", "line", ribbon(path, weight)),
            ...stalkedLeaf(at.p, at.θ + 0.95, 2, r.between(6, 6.8)).marks,
        ];

        /* Two shoots further down, each sprouting once the unrolling stem has
           carried past it, and growing to its full size over the next
           stretch: a tendril curling outward, then a leaf on the near side. */
        for (const { from, kind, side } of HANGING_SHOOTS) {
            const grown = Math.min(1, (down - from) / 8);
            if (grown <= 0) continue;
            const { p, θ } = path.at(lead + from);
            if (kind === "leaf") {
                frame.push(
                    ...stalkedLeaf(
                        p,
                        θ + side * 0.95,
                        lerp(0.8, 2.2, grown),
                        lerp(3, 6.4, grown),
                        { side },
                    ).marks,
                );
            } else {
                const { path: tendril } = scroll(p, θ + side * 0.45, side, {
                    length: lerp(4, 12, grown),
                    turns: lerp(0.5, 1.4, grown),
                    κ0: 0.06,
                    growth: 2.2,
                });
                frame.push(
                    mark(
                        "leaf",
                        "line",
                        ribbon(tendril, (s) => lerp(1, 0.4, s)),
                    ),
                );
            }
        }
        marks.push(...moved([...held, ...frame], [k * COIL.w, 0]));
    }
    const svg = picture(marks, [0, 0, COIL.w * COIL.frames, COIL.h], {
        leaf,
        iron,
        pot,
        ground,
    });
    const column = COIL.x + H / 2;
    return {
        ...placed(svg, [-column, -COIL.h, COIL.w, COIL.h]),
        frames: COIL.frames,
    };
}

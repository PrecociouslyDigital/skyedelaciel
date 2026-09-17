#!/usr/bin/env node
// @ts-check
/**
 * Draws the site's mark, as `public/logo.svg` and `public/favicon.svg`.
 *
 *   node tools/logo.mjs
 *
 * The mark is the seed of the flower of life: six circles of one radius whose
 * centres sit on a ring of that same radius, so every one of them passes
 * through the centre. Each petal is the 240° arc of its circle that does so,
 * and a hexagon holds them. Each stroke is drawn as a brush ribbon — a filled
 * outline whose width varies along the stroke — rather than a stroked path, so
 * the whole mark is one flat fill that CSS can mask and recolour.
 *
 * See breadcrumbs/tools/logo.mjs.md for why it is generated rather than drawn.
 */

import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ─── Points ──────────────────────────────────────────────────────────────────

/** @typedef {{ x: number, y: number }} Point */

const radians = (/** @type {number} */ degrees) => (degrees * Math.PI) / 180;

/** @returns {Point} */
const polar = (/** @type {number} */ r, /** @type {number} */ degrees) => ({
    x: r * Math.cos(radians(degrees)),
    y: r * Math.sin(radians(degrees)),
});

const add = (/** @type {Point} */ a, /** @type {Point} */ b) => ({
    x: a.x + b.x,
    y: a.y + b.y,
});
const sub = (/** @type {Point} */ a, /** @type {Point} */ b) => ({
    x: a.x - b.x,
    y: a.y - b.y,
});
const scale = (/** @type {Point} */ a, /** @type {number} */ k) => ({
    x: a.x * k,
    y: a.y * k,
});
const lerp = (
    /** @type {Point} */ a,
    /** @type {Point} */ b,
    /** @type {number} */ t,
) => add(a, scale(sub(b, a), t));

const size = (/** @type {Point} */ a) => Math.hypot(a.x, a.y);
const unit = (/** @type {Point} */ a) => scale(a, 1 / size(a));
const cross = (/** @type {Point} */ a, /** @type {Point} */ b) =>
    a.x * b.y - a.y * b.x;
const dot = (/** @type {Point} */ a, /** @type {Point} */ b) =>
    a.x * b.x + a.y * b.y;

/** A quarter turn, which is the direction the brush's edge lies in. */
const perpendicular = (/** @type {Point} */ a) => ({ x: -a.y, y: a.x });

/**
 * Indexed access that cannot be `undefined`, and that wraps — which is what a
 * closed stroke's neighbours need anyway.
 * @template T
 * @param {T[]} items
 * @param {number} index
 * @returns {T}
 */
function at(items, index) {
    const value = items[((index % items.length) + items.length) % items.length];
    if (value === undefined)
        throw new Error("read past the end of an empty list");
    return value;
}

// ─── Strokes ─────────────────────────────────────────────────────────────────

/**
 * A centreline, parameterised by arc length so that everything measured along
 * it — where a crossing falls, how wide a gap has to be — is in one unit.
 *
 * `at` is defined outside [0, length] as well: the tangent is read off a
 * central difference, and the ends need one.
 *
 * @typedef {object} Stroke
 * @property {(s: number) => Point} at
 * @property {number} length
 * @property {boolean} closed
 */

/**
 * Petal `k`: the 240° arc of circle `k` that passes through the centre. The
 * 120° it leaves out is the cap furthest from the centre, so the six arcs meet
 * tip to tip in a rosette.
 *
 * @param {number} k
 * @param {number} radius  both the circle's radius and the ring its centre is on
 * @returns {Stroke}
 */
function petal(k, radius) {
    const spoke = 60 * k;
    const centre = polar(radius, spoke);
    const sweep = 240;
    const length = radius * radians(sweep);
    return {
        length,
        closed: false,
        at: (s) =>
            add(centre, polar(radius, spoke + 60 + (sweep * s) / length)),
    };
}

/**
 * The frame the petals sit in: flat-topped, and thinner than they are, so that
 * inside the seal's square it reads as the hairline to the border's heavy rule.
 *
 * @param {number} radius  circumradius, which for a regular hexagon is its side
 * @returns {Stroke}
 */
function hexagon(radius) {
    const length = 6 * radius;
    return {
        length,
        closed: true,
        at: (s) => {
            const along = ((s % length) + length) % length;
            const side = Math.floor(along / radius);
            return lerp(
                polar(radius, 60 * side),
                polar(radius, 60 * (side + 1)),
                along / radius - side,
            );
        },
    };
}

const tangent = (/** @type {Stroke} */ stroke, /** @type {number} */ s) => {
    const step = stroke.length * 1e-5;
    return unit(sub(stroke.at(s + step), stroke.at(s - step)));
};

/**
 * @param {Stroke} stroke
 * @param {number} step  roughly how far apart the samples should be
 * @returns {{ s: number, p: Point }[]}
 */
function sample(stroke, step) {
    const count = Math.max(2, Math.round(stroke.length / step));
    const last = stroke.closed ? count - 1 : count;
    return Array.from({ length: last + 1 }, (_, i) => {
        const s = (stroke.length * i) / count;
        return { s, p: stroke.at(s) };
    });
}

// ─── Where strokes cross ─────────────────────────────────────────────────────

/**
 * A place one stroke has to make way for another: how far along it the crossing
 * falls, and how wide the brush has to be lifted for.
 *
 * @typedef {{ at: number, half: number }} Gap
 */

/**
 * Every crossing of two centrelines, found by walking them as polylines.
 *
 * @param {Stroke} under
 * @param {Stroke} over
 * @param {number} step
 * @returns {{ under: number, over: number, angle: number }[]}
 */
function crossings(under, over, step) {
    const a = sample(under, step);
    const b = sample(over, step);
    /** @type {{ under: number, over: number, angle: number }[]} */
    const found = [];

    for (let i = 0; i + 1 < a.length + (under.closed ? 1 : 0); i++) {
        const a0 = at(a, i);
        const a1 = at(a, i + 1);
        const ra = sub(a1.p, a0.p);
        for (let j = 0; j + 1 < b.length + (over.closed ? 1 : 0); j++) {
            const b0 = at(b, j);
            const b1 = at(b, j + 1);
            const rb = sub(b1.p, b0.p);

            const denominator = cross(ra, rb);
            if (Math.abs(denominator) < 1e-9) continue;
            const between = sub(b0.p, a0.p);
            const t = cross(between, rb) / denominator;
            const u = cross(between, ra) / denominator;
            if (t < 0 || t > 1 || u < 0 || u > 1) continue;

            const wrapped = (
                /** @type {{s: number}} */ start,
                /** @type {{s: number}} */ end,
                /** @type {number} */ fraction,
                /** @type {Stroke} */ stroke,
            ) =>
                start.s +
                fraction * ((end.s === 0 ? stroke.length : end.s) - start.s);

            found.push({
                under: wrapped(a0, a1, t, under),
                over: wrapped(b0, b1, u, over),
                angle: Math.acos(
                    Math.min(1, Math.abs(dot(unit(ra), unit(rb)))),
                ),
            });
        }
    }

    // Adjacent segments can both report the same crossing; keep one of each.
    return found.filter((crossing, index) =>
        found
            .slice(0, index)
            .every(
                (earlier) => Math.abs(earlier.under - crossing.under) > step,
            ),
    );
}

/**
 * Turn crossings into gaps: wide enough to clear the other ribbon where it
 * passes, plus a margin, and wider still where the two meet at a shallow angle.
 *
 * @param {{ under: number, over: number, angle: number }[]} found
 * @param {(t: number) => number} overWidth  the other ribbon's half-width
 * @param {Stroke} over
 * @param {number} margin
 * @returns {Gap[]}
 */
const gapsFor = (found, overWidth, over, margin) =>
    found.map(({ under, over: s, angle }) => ({
        at: under,
        half:
            (overWidth(s / over.length) + margin) /
            Math.max(0.2, Math.sin(angle)),
    }));

// ─── Ribbons ─────────────────────────────────────────────────────────────────

const smoothstep = (/** @type {number} */ x) => x * x * (3 - 2 * x);

/**
 * How much of the brush is on the paper at arc length `s`: nothing inside a
 * gap, everything well clear of one, and a smooth lift in between so that both
 * sides of a cut taper the way a lifted brush does.
 *
 * @param {number} s
 * @param {Stroke} stroke
 * @param {Gap[]} gaps
 * @param {number} lift  how far the taper runs
 */
function contact(s, stroke, gaps, lift) {
    let least = 1;
    for (const gap of gaps) {
        const apart = Math.abs(s - gap.at);
        const distance = stroke.closed
            ? Math.min(apart, stroke.length - apart)
            : apart;
        const clear = Math.max(0, distance - gap.half);
        least = Math.min(least, smoothstep(Math.min(1, clear / lift)));
    }
    return least;
}

const round = (/** @type {number} */ value) =>
    (Math.round(value * 10) / 10).toString();
const place = (/** @type {Point} */ p) => `${round(p.x)},${round(p.y)}`;

/** One closed outline: down one edge of the brush and back up the other. */
const outline = (/** @type {Point[]} */ edge, /** @type {Point[]} */ back) =>
    `M${[...edge, ...back].map(place).join(" ")}Z`;

/**
 * The area a brush of half-width `width` covers along `stroke`, lifted over
 * each gap. Emitted as one or more closed subpaths of a single filled path —
 * no strokes and no masks, so `currentColor` and CSS masking both just work.
 *
 * @param {Stroke} stroke
 * @param {(t: number) => number} width  half-width, over t in [0, 1]
 * @param {Gap[]} gaps
 * @param {number} lift
 * @param {number} step
 */
function ribbon(stroke, width, gaps, lift, step) {
    const marks = sample(stroke, step).map(({ s, p }) => {
        const half = width(s / stroke.length) * contact(s, stroke, gaps, lift);
        const edge = scale(perpendicular(tangent(stroke, s)), half);
        return {
            s,
            touching: half > 0,
            left: add(p, edge),
            right: sub(p, edge),
        };
    });

    // A gap narrower than the space between samples would fall between two of
    // them and leave the ribbon whole, which is an interlace silently undone.
    for (const gap of gaps) {
        const lands = marks.some(
            (mark) => !mark.touching && Math.abs(mark.s - gap.at) <= gap.half,
        );
        if (!lands) {
            throw new Error(
                `the gap at ${round(gap.at)} is too narrow to land between samples ${step} apart`,
            );
        }
    }

    // A closed ribbon with nothing lifting it is a ring: one outline around the
    // outside and one, wound the other way, punching out the inside.
    if (stroke.closed && marks.every((mark) => mark.touching)) {
        return (
            outline(
                marks.map((mark) => mark.left),
                [],
            ) + outline(marks.map((mark) => mark.right).reverse(), [])
        );
    }

    /** Runs of consecutive samples the brush is touching, wrapping if closed. */
    const runs = [];
    let run = [];
    const first = marks.findIndex((mark) => !mark.touching);
    const order = stroke.closed
        ? Array.from({ length: marks.length }, (_, i) => at(marks, first + i))
        : marks;
    for (const mark of order) {
        if (mark.touching) run.push(mark);
        else if (run.length > 0) {
            runs.push(run);
            run = [];
        }
    }
    if (run.length > 0) runs.push(run);

    return runs
        .filter((piece) => piece.length > 1)
        .map((piece) =>
            outline(
                piece.map((mark) => mark.left),
                piece.map((mark) => mark.right).reverse(),
            ),
        )
        .join("");
}

// ─── The brush ───────────────────────────────────────────────────────────────

/**
 * A petal's half-width along its arc.
 *
 * Pressed at both ends and thinner at the waist, which is how a 橫 is written
 * and, here, the only shape that works: six identical strokes rotated about one
 * point, so a brush that pressed at the start and lifted at the end would turn
 * the rosette into a pinwheel. The waist also keeps the six from pooling into a
 * disc where they all cross at the centre.
 *
 * @param {number} weight
 * @param {{ waist: number, tip: number }} brush
 */
const petalBrush =
    (weight, { waist, tip }) =>
    (/** @type {number} */ t) => {
        const along = Math.min(1, Math.max(0, t));
        const belly = 1 - waist * Math.sin(Math.PI * along);
        const ends = Math.min(
            1,
            (along / tip) ** 0.6,
            ((1 - along) / tip) ** 0.6,
        );
        return weight * belly * ends;
    };

/** The hexagon's, which only breathes a little from side to side. */
const hexBrush = (/** @type {number} */ weight) => (/** @type {number} */ t) =>
    weight * (1 + 0.12 * Math.sin(radians(360 * 3 * t + 40)));

// ─── The mark ────────────────────────────────────────────────────────────────

/**
 * @typedef {object} Params
 * @property {number} [radius]       petal circle radius, and the ring of centres
 * @property {number} [hexRadius]
 * @property {number} [petalWeight]  widest half-width of a petal
 * @property {number} [waist]        how much a petal thins between its tips
 * @property {number} [tip]          how much of each end is the brush landing
 * @property {boolean} [frame]      draw the hexagon at all
 * @property {number} [hexWeight]
 * @property {number} [margin]       clearance either side of an under-pass
 * @property {number} [lift]         how far a cut end tapers
 * @property {number} [padding]      clear space around the mark
 * @property {number} [step]         distance between samples
 */

/** What `public/logo.svg` is drawn with. */
export const LOGO = {
    radius: 171.8,
    hexRadius: 253.8,
    petalWeight: 15,
    waist: 0.38,
    tip: 0.04,
    frame: true,
    hexWeight: 9.5,
    margin: 4,
    lift: 10,
    padding: 26,
    step: 5,
};

/**
 * The same mark for sixteen pixels in a tab: heavier, barely waisted, cropped
 * close, and with the hexagon dropped. At that size the frame is a ring of
 * specks that fills the gaps between the petals and turns the whole mark into a
 * blot; the rosette alone still reads as a flower.
 */
export const FAVICON = {
    ...LOGO,
    petalWeight: 26,
    waist: 0.2,
    frame: false,
    padding: 6,
};

/**
 * @param {Params} [params]
 * @returns {string} the whole SVG file, ready to write
 */
export function renderLogo(params = {}) {
    const {
        radius,
        hexRadius,
        petalWeight,
        waist,
        tip,
        frame: drawFrame,
        hexWeight,
        margin,
        lift,
        padding,
        step,
    } = { ...LOGO, ...params };

    const petals = Array.from({ length: 6 }, (_, k) => petal(k, radius));
    const frame = hexagon(hexRadius);
    const petalWidth = petalBrush(petalWeight, { waist, tip });
    const hexWidth = hexBrush(hexWeight);

    /**
     * The weave. Petal k passes under the petal two spokes behind it and over
     * the one two ahead, which gives every petal exactly one gap. All six also
     * meet at the dead centre, where six strokes cannot be woven at all and the
     * drawn mark pools — so only the outer crossing of a pair is read.
     */
    const petalPaths = petals.map((stroke, k) => {
        const over = at(petals, k + 4);
        const outer = crossings(stroke, over, step).filter(
            (crossing) => size(stroke.at(crossing.under)) > radius / 2,
        );
        if (outer.length !== 1) {
            throw new Error(
                `petal ${k} should cross petal ${(k + 4) % 6} once away from the centre, not ${outer.length} times`,
            );
        }
        return ribbon(
            stroke,
            petalWidth,
            gapsFor(outer, petalWidth, over, margin),
            lift,
            step,
        );
    });

    /** The hexagon goes under every petal, so it collects all twelve gaps. */
    const framePath = drawFrame
        ? ribbon(
              frame,
              hexWidth,
              petals.flatMap((over) =>
                  gapsFor(
                      crossings(frame, over, step),
                      petalWidth,
                      over,
                      margin,
                  ),
              ),
              lift,
              step,
          )
        : null;

    const paths = [
        ...petalPaths.map((d, k) => ({ id: `petal-${k}`, d })),
        ...(framePath === null ? [] : [{ id: "frame", d: framePath }]),
    ];

    // Square, centred on the point every petal passes through, so the mark sits
    // where a seal or a favicon expects to find it.
    const reach = Math.max(
        ...paths.flatMap(({ d }) =>
            [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((number) =>
                Math.abs(Number(number[0])),
            ),
        ),
    );
    const half = Math.round((reach + padding) * 10) / 10;

    return [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-half} ${-half} ${half * 2} ${half * 2}" fill="currentColor">`,
        ...paths.map(({ id, d }) => `  <path id="${id}" d="${d}"/>`),
        "</svg>",
        "",
    ].join("\n");
}

/** Every file this generator owns, and what each is drawn with. */
export const outputs = [
    { file: "public/logo.svg", params: LOGO },
    { file: "public/favicon.svg", params: FAVICON },
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    for (const { file, params } of outputs) {
        writeFileSync(join(repoRoot, file), renderLogo(params));
        console.log(file);
    }
}

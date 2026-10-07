// @ts-check
/* A quilt of square blocks, pieced together at random, and the frames in
   which it is laid down patch by patch. One quilt can be laid down in more
   than one order: a pane resolves through it in one order and unresolves in
   another, so that leaving is not arriving played backwards. Plain JS, so
   that Sass can call it while it compiles; see src/integrations/vines.ts. */

import { chance } from "./chance.mjs";
import { svgOf } from "./pen.mjs";

/**
 * A rectangle of the grid, in cells, and how strongly it is inked.
 *
 * @typedef {{ x: number, y: number, w: number, h: number, strength: number }} Patch
 */

/**
 * A grid `cols` cells across and `rows` down, and which of its quilts.
 *
 * @typedef {{ cols: number, rows: number, seed: number }} Grid
 */

/** How strongly a patch is inked. Some patches are left blank. */
const STRENGTHS = [0, 0.35, 0.55, 0.8, 1];

/** The largest patch, in cells across and down. */
const WIDEST = 3;
const TALLEST = 2;

/**
 * The patches that tile a grid, each with its strength. Read row by row,
 * every cell not yet covered starts a patch, which reaches right and down as
 * far as its size allows and the cells there are free.
 *
 * @param {Grid} grid
 * @returns {Patch[]}
 */
export function quilt({ cols, rows, seed }) {
    const r = chance(seed);
    const covered = new Set();
    const free = (/** @type {number} */ x, /** @type {number} */ y) =>
        x < cols && y < rows && !covered.has(y * cols + x);
    const patches = [];

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (!free(x, y)) continue;
            let w = 1;
            let h = 1;
            const width = 1 + r.integer(WIDEST);
            const height = 1 + r.integer(TALLEST);
            while (w < width && free(x + w, y)) w++;
            while (
                h < height &&
                Array.from({ length: w }, (_, i) => free(x + i, y + h)).every(
                    Boolean,
                )
            )
                h++;
            for (let dy = 0; dy < h; dy++)
                for (let dx = 0; dx < w; dx++)
                    covered.add((y + dy) * cols + x + dx);
            patches.push({ x, y, w, h, strength: r.pick(STRENGTHS) });
        }
    }
    return patches;
}

/**
 * The quilt laid down over `frames` frames, in an order drawn from `order`:
 * frame `f` (from 1) holds every patch down by then, so each frame holds the
 * one before it and the last holds the whole quilt.
 *
 * @param {Grid & { order: number, frames: number }} laying
 * @returns {Patch[][]}
 */
export function laidDown({ cols, rows, seed, order, frames }) {
    const r = chance(order);
    const patches = quilt({ cols, rows, seed });
    // Fisher–Yates, so every order is as likely as any other.
    for (let i = patches.length - 1; i > 0; i--) {
        const j = r.integer(i + 1);
        [patches[i], patches[j]] = /** @type {[Patch, Patch]} */ ([
            patches[j],
            patches[i],
        ]);
    }
    return Array.from({ length: frames }, (_, f) =>
        patches.slice(0, Math.round(((f + 1) * patches.length) / frames)),
    );
}

/**
 * A strip of single cells at random strengths: the blocks an entry of the
 * contents shows before its words. They are not made from the letters, only
 * cut to about their size, which is all the eye takes in at that speed. One
 * more blank than a quilt has, so a word's blocks lie sparser than a pane's.
 *
 * @param {Grid} grid
 * @returns {Patch[]}
 */
export function blocks({ cols, rows, seed }) {
    const r = chance(seed);
    const strengths = [0, ...STRENGTHS];
    return Array.from({ length: rows * cols }, (_, i) => ({
        x: i % cols,
        y: Math.floor(i / cols),
        w: 1,
        h: 1,
        strength: r.pick(strengths),
    }));
}

/**
 * Patches as an SVG mask, one path for each strength.
 *
 * @param {Patch[]} patches
 * @param {number} cols
 * @param {number} rows
 * @returns {string}
 */
export function patchesSvg(patches, cols, rows) {
    /** @type {Map<number, string>} */
    const paths = new Map();
    for (const { x, y, w, h, strength } of patches) {
        if (!strength) continue;
        paths.set(
            strength,
            `${paths.get(strength) ?? ""}M${x} ${y}h${w}v${h}h-${w}z`,
        );
    }
    const drawn = [...paths]
        .map(([a, d]) => `<path fill-opacity='${a}' d='${d}'/>`)
        .join("");
    return svgOf(
        `0 0 ${cols} ${rows}`,
        drawn,
        " preserveAspectRatio='none' shape-rendering='crispEdges'",
    );
}

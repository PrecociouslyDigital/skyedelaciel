import type { AstroIntegration } from "astro";
import * as sass from "sass";
import { strokePiece } from "../layouts/prelude/brush.mjs";
import { chance } from "../layouts/prelude/chance.mjs";
import { laidDown, patchesSvg } from "../layouts/prelude/patchwork.mjs";
import {
    blossom,
    hanging,
    shoot,
    tocVine,
    vine,
} from "../layouts/prelude/vine.mjs";
import { drawingsDir, store } from "./drawn";

/** What a `$vines` entry gives a drawing to draw from. */
type Args = Record<string, number | boolean | string>;

/** A drawing, and where it lies about the point it is placed by. */
interface Drawn {
    svg: string;
    box?: { x: number; y: number; w: number; h: number };
    frames?: number;
}

/**
 * Each kind of drawing the stylesheets can ask for, by the name they ask by.
 * A kind reads what it needs of the arguments and ignores the rest, so one
 * `$vines` entry, inks and all, can be handed to any of them.
 */
const kinds: Record<string, (args: Args) => Drawn> = {
    rule: (args) => ({ svg: vine(args as Parameters<typeof vine>[0]) }),
    toc: (args) => ({ svg: tocVine(args as Parameters<typeof tocVine>[0]) }),
    shoot: (args) => shoot(args as Parameters<typeof shoot>[0]),
    blossom: (args) => blossom(args as Parameters<typeof blossom>[0]),
    hanging: (args) => hanging(args as Parameters<typeof hanging>[0]),
    stroke: (args) => strokePiece(args as Parameters<typeof strokePiece>[0]),
};

/**
 * Lets the stylesheets draw vines, the pieces of the table of contents that
 * grow from them, and the brush strokes of brush.mjs. Two Sass functions,
 * evaluated while the stylesheet compiles:
 *
 * - `drawing($kind, $args)` returns a `url()` to the drawing;
 * - `vine-box($kind, $args)` returns where the drawing lies about the point
 *   it is placed by, in widths of a vine, as `($x, $y, $width, $height,
 *   $frames)`; for a piece of a stroke, its size in bands.
 *
 * `$args` is a map, of numbers, booleans, strings and colours. See
 * `vine-image` and `drawing-box` in _ornaments.scss.
 *
 * A drawing is a file rather than a data URL. Each scheme needs its own copy
 * of every vine with its colours baked in, and inlined they would bloat the
 * stylesheet every page waits on. As files, a page fetches only the vines its
 * scheme shows, and Vite fingerprints and serves them like any other asset the
 * stylesheet names.
 *
 * The files are kept by `store`, in drawn.ts.
 *
 * Two more, `blocks($cols, $rows, $seed)` and `patchwork($cols, $rows, $seed,
 * $order, $frame, $frames)`, are the patterns things resolve through, inline:
 * they have no colour of their own, and are the same in every scheme.
 */
export default function vines(): AstroIntegration {
    return {
        name: "vines",
        hooks: {
            "astro:config:setup": ({ config, updateConfig }) => {
                /* Every scheme is applied more than once, so the same
                   drawing is asked for again and again. */
                const drawn = new Map<string, Drawn>();
                const draw = ([kind, args]: sass.Value[]) => {
                    const name = kind!.assertString("kind").text;
                    const of = kinds[name];
                    if (!of) throw new Error(`there is no ${name} drawing.`);
                    const values = fromSass(args!.assertMap("args"));
                    const key = JSON.stringify([name, values]);
                    if (!drawn.has(key)) drawn.set(key, of(values));
                    return drawn.get(key)!;
                };

                const file = (svg: string) =>
                    new sass.SassString(`url(${store(config.root, svg)})`, {
                        quotes: false,
                    });

                const box = (args: sass.Value[]) => {
                    const { box, frames = 1 } = draw(args);
                    if (!box) {
                        throw new Error(
                            `${args[0]} drawings are not placed by a point, so have no box.`,
                        );
                    }
                    return new sass.SassList(
                        [box.x, box.y, box.w, box.h, frames].map(
                            (n) => new sass.SassNumber(n),
                        ),
                        { separator: "," },
                    );
                };

                const ours = drawingsDir(config.root);

                updateConfig({
                    vite: {
                        // Vite would otherwise inline every drawing small
                        // enough to fit its limit, which is most of the
                        // table of contents' pieces; anything else keeps the
                        // limit Vite would give it.
                        build: {
                            assetsInlineLimit: (path: string) =>
                                path.replaceAll("\\", "/").startsWith(ours)
                                    ? false
                                    : undefined,
                        },
                        css: {
                            preprocessorOptions: {
                                scss: {
                                    functions: {
                                        "drawing($kind, $args)": (
                                            args: sass.Value[],
                                        ) => file(draw(args).svg),
                                        "vine-box($kind, $args)": box,
                                        "blocks($cols, $rows, $seed)": blocks,
                                        "patchwork($cols, $rows, $seed, $order, $frame, $frames)":
                                            patchwork,
                                    },
                                },
                            },
                        },
                    },
                });
            },
        },
    };
}

/** A Sass map of numbers, booleans and colours, as plain values. */
function fromSass(map: sass.SassMap): Args {
    const out: Args = {};
    for (const [key, value] of map.contents) {
        const name = key.assertString("key").text;
        if (value instanceof sass.SassNumber) out[name] = value.value;
        else if (value instanceof sass.SassColor) out[name] = hex(value);
        else if (value instanceof sass.SassString) out[name] = value.text;
        else out[name] = value.isTruthy;
    }
    return out;
}

/** A colour as the six-digit hex an SVG attribute takes. */
function hex(color: sass.SassColor): string {
    const rgb = color.toSpace("rgb");
    return (
        "#" +
        (["red", "green", "blue"] as const)
            .map((channel) =>
                Math.round(rgb.channel(channel)).toString(16).padStart(2, "0"),
            )
            .join("")
    );
}

/**
 * A strip of squares at random strengths, `$cols` across and `$rows` down, as
 * an inline `url()` to be used as a mask: the blocks an entry of the contents
 * shows before its words. They are not made from the letters, only cut to
 * about their size, which is all the eye takes in at that speed.
 */
function blocks(args: sass.Value[]) {
    const [cols, rows, seed] = integers(args) as [number, number, number];
    const r = chance(seed);
    const strengths = [0, 0, 0.35, 0.55, 0.8, 1];
    const squares = Array.from({ length: rows * cols }, (_, i) => ({
        x: i % cols,
        y: Math.floor(i / cols),
        w: 1,
        h: 1,
        strength: strengths[r.integer(strengths.length)]!,
    }));
    return mask(patchesSvg(squares, cols, rows));
}

/**
 * Frame `$frame` of `$frames` in which a quilt of blocks is laid down, in the
 * order `$order` draws: the coarse blocks a popover's pane arrives as. See
 * patchwork.mjs.
 */
function patchwork(args: sass.Value[]) {
    const [cols, rows, seed, order, frame, frames] = integers(args) as [
        number,
        number,
        number,
        number,
        number,
        number,
    ];
    const patches = laidDown({ cols, rows, seed, order, frames })[frame - 1];
    if (!patches) throw new Error(`there is no frame ${frame} of ${frames}.`);
    return mask(patchesSvg(patches, cols, rows));
}

/** The integers a Sass function was called with. */
const integers = (args: sass.Value[]) =>
    args.map((arg) => arg.assertNumber().assertInt());

/**
 * An SVG as an inline `url()` for a mask. Inline, it is in the stylesheet
 * every page waits on, so it is written small: only the characters a data URL
 * cannot carry are escaped.
 */
function mask(svg: string) {
    const escaped = svg.replace(/[%#<>]/g, encodeURIComponent);
    return new sass.SassString(`url("data:image/svg+xml,${escaped}")`, {
        quotes: false,
    });
}

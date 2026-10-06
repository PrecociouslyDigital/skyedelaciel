import type { AstroIntegration } from "astro";
import * as sass from "sass";
import { chance } from "../layouts/prelude/chance.mjs";
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
};

/**
 * Lets the stylesheets draw vines, and the pieces of the table of contents
 * that grow from them. Two Sass functions, evaluated while the stylesheet
 * compiles:
 *
 * - `drawing($kind, $args)` returns a `url()` to the drawing;
 * - `vine-box($kind, $args)` returns where the drawing lies about the point
 *   it is placed by, in widths of a vine, as `($x, $y, $width, $height,
 *   $frames)`.
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
 * A third function, `blocks($cols, $rows, $seed)`, is the pattern the table
 * of contents resolves its entries through, inline: it has no colour of its
 * own, and is the same in every scheme.
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
 *
 * Inline, it is in the stylesheet every page waits on, so it is written small:
 * one path for each strength, and only the characters a data URL cannot
 * carry are escaped.
 */
function blocks([cols, rows, seed]: sass.Value[]) {
    const [across, down] = [cols!, rows!].map((n) =>
        n.assertNumber().assertInt(),
    ) as [number, number];
    const r = chance(seed!.assertNumber("seed").assertInt("seed"));
    const strengths = [0, 0, 0.35, 0.55, 0.8, 1];
    const squares = new Map<number, string>();
    for (let y = 0; y < down; y++) {
        for (let x = 0; x < across; x++) {
            const a = strengths[r.integer(strengths.length)]!;
            if (a) squares.set(a, `${squares.get(a) ?? ""}M${x} ${y}h1v1h-1z`);
        }
    }
    const paths = [...squares]
        .map(([a, d]) => `<path fill-opacity='${a}' d='${d}'/>`)
        .join("");
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${across} ${down}' preserveAspectRatio='none' shape-rendering='crispEdges'>${paths}</svg>`;
    const escaped = svg.replace(/[%#<>]/g, encodeURIComponent);
    return new sass.SassString(`url("data:image/svg+xml,${escaped}")`, {
        quotes: false,
    });
}

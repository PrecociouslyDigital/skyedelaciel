import type { AstroIntegration } from "astro";
import * as sass from "sass";
import * as z from "zod";
import { strokePiece } from "../layouts/prelude/brush.mjs";
import { blocks, laidDown, patchesSvg } from "../layouts/prelude/patchwork.mjs";
import {
    blossom,
    hanging,
    INKS,
    shoot,
    tocVine,
    vine,
    type Ink,
} from "../layouts/prelude/vine.mjs";
import { drawingsDir, store } from "./drawn";

/** What a `$vines` entry gives a drawing to draw from. */
type Args = Record<string, number | boolean | string>;

/** A drawing laid along a line: a rule, or a section's vine. */
interface Drawing {
    svg: string;
}

/**
 * A drawing placed by a point, and where it lies about that point: in vine
 * widths, or for a piece of a stroke, in bands. A strip of `frames` frames
 * side by side has the box of one.
 */
interface Placed extends Drawing {
    box: { x: number; y: number; w: number; h: number };
    frames?: number;
}

/** A colour, as `hex` writes it. */
const colour = z.string().regex(/^#[0-9a-f]{6}$/);

/**
 * One kind of drawing: the shape of the arguments it is drawn from, the inks
 * it paints in, and how it draws.
 *
 * A kind reads what it needs of the arguments and ignores the rest, so one
 * `$vines` entry, inks and all, can be handed to any of them. A missing
 * argument fails the build, naming the drawing.
 */
function kind<Shape extends z.ZodRawShape, I extends Ink, D extends Drawing>(
    shape: Shape,
    inks: readonly I[],
    draw: (args: z.infer<z.ZodObject<Shape>> & Record<I, string>) => D,
) {
    const painted = z.object({
        ...shape,
        ...Object.fromEntries(inks.map((ink) => [ink, colour])),
    }) as unknown as z.ZodType<z.infer<z.ZodObject<Shape>> & Record<I, string>>;
    return {
        /** The drawing, in the inks `args` gives it. */
        drawn: (args: Args) => draw(painted.parse(args)),
        /**
         * The drawing in any inks, for where it lies alone: a box is the same
         * in every scheme, so its inks are filled in with the first to hand.
         */
        shaped: (args: Args) =>
            draw(
                painted.parse({
                    ...Object.fromEntries(inks.map((ink) => [ink, "#000000"])),
                    ...args,
                }),
            ),
    };
}

const seed = z.number();

/** The drawings laid along a line, by the name the stylesheets ask by. */
const lines = {
    rule: kind(
        {
            ratio: z.number(),
            seed,
            centred: z.boolean(),
            upright: z.boolean().optional(),
            blooms: z.boolean().optional(),
        },
        ["leaf", "flower", "ground"],
        (args) => ({ svg: vine(args) }),
    ),
    toc: kind({ ratio: z.number(), seed }, ["leaf", "ground"], (args) => ({
        svg: tocVine(args),
    })),
};

/** The drawings placed by a point, by the name the stylesheets ask by. */
const placed = {
    shoot: kind(
        { reach: z.number(), radius: z.number(), seed },
        ["leaf", "ground"],
        shoot,
    ),
    blossom: kind({ seed }, ["leaf", "flower", "ground"], blossom),
    hanging: kind(
        { seed, rise: z.number() },
        ["leaf", "iron", "pot", "ground"],
        hanging,
    ),
    stroke: kind(
        {
            seed: z.union([z.number(), z.string()]),
            axis: z.enum(["across", "down"]),
            piece: z.enum(["head", "body", "tail"]),
            ruled: z.boolean().optional(),
        },
        [],
        strokePiece,
    ),
} satisfies Record<string, { shaped: (args: Args) => Placed }>;

/** The kind a stylesheet names, from one of the tables above. */
function kindOf<Table extends Record<string, unknown>>(
    table: Table,
    name: string,
    what: string,
): Table[keyof Table] {
    if (!Object.hasOwn(table, name))
        throw new Error(`there is no ${name} drawing ${what}.`);
    return table[name as keyof Table];
}

/**
 * Lets the stylesheets draw vines, the pieces of the table of contents that
 * grow from them, and the brush strokes of brush.mjs. Two Sass functions,
 * evaluated while the stylesheet compiles:
 *
 * - `drawing($kind, $args)` returns a `url()` to the drawing;
 * - `vine-box($kind, $args)` returns where a placed drawing lies about the
 *   point it is placed by, in widths of a vine, as `($x, $y, $width,
 *   $height, $frames)`; for a piece of a stroke, its size in bands.
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
 * they have no colour of their own, and are the same in every scheme. See
 * patchwork.mjs.
 */
export default function vines(): AstroIntegration {
    return {
        name: "vines",
        hooks: {
            "astro:config:setup": ({ config, updateConfig }) => {
                /* Every scheme is applied more than once, so the same
                   drawing is asked for again and again. */
                const cache = new Map<string, Drawing>();
                const remembered = <D extends Drawing>(
                    key: unknown[],
                    draw: () => D,
                ): D => {
                    const k = JSON.stringify(key);
                    if (!cache.has(k)) cache.set(k, draw());
                    return cache.get(k) as D;
                };
                const read = ([kind, args]: sass.Value[]) => ({
                    name: kind!.assertString("kind").text,
                    args: fromSass(args!.assertMap("args")),
                });

                const drawing = (sassArgs: sass.Value[]) => {
                    const { name, args } = read(sassArgs);
                    const { drawn } = kindOf({ ...lines, ...placed }, name, "");
                    const { svg } = remembered([name, args], () => drawn(args));
                    return new sass.SassString(
                        `url(${store(config.root, svg)})`,
                        { quotes: false },
                    );
                };

                const box = (sassArgs: sass.Value[]) => {
                    const { name, args } = read(sassArgs);
                    const { shaped } = kindOf(
                        placed,
                        name,
                        "placed by a point, so none has a box",
                    );
                    const { box, frames = 1 } = remembered<Placed>(
                        [name, args],
                        () => shaped(args),
                    );
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
                                        "drawing($kind, $args)": drawing,
                                        "vine-box($kind, $args)": box,
                                        "blocks($cols, $rows, $seed)": blocksOf,
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

/** The numbers a Sass function was called with. */
const numbers = (args: sass.Value[]) =>
    args.map((arg) => arg.assertNumber().value);

const int = z.number().int();

/** The blocks an entry of the contents resolves through, as an inline mask. */
function blocksOf(args: sass.Value[]) {
    const [cols, rows, seed] = z.tuple([int, int, int]).parse(numbers(args));
    return mask(patchesSvg(blocks({ cols, rows, seed }), cols, rows));
}

/**
 * Frame `$frame` of `$frames` in which a quilt of blocks is laid down, in the
 * order `$order` draws: the coarse blocks a popover's pane arrives as.
 */
function patchwork(args: sass.Value[]) {
    const [cols, rows, seed, order, frame, frames] = z
        .tuple([int, int, int, int, int, int])
        .parse(numbers(args));
    const patches = laidDown({ cols, rows, seed, order, frames })[frame - 1];
    if (!patches) throw new Error(`there is no frame ${frame} of ${frames}.`);
    return mask(patchesSvg(patches, cols, rows));
}

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

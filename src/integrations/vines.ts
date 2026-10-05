import type { AstroIntegration } from "astro";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as sass from "sass";
import { vine } from "../layouts/prelude/vine.mjs";

/**
 * Lets the stylesheets draw vines: `vine($ratio, $seed, $centred, $leaf,
 * $flower)` is a Sass function, evaluated while the stylesheet compiles, that
 * returns a `url()` to the drawing. See `vine-rule` in _ornaments.scss.
 *
 * The drawing is a file rather than a data URL. Each scheme needs its own copy
 * of every vine with its colours baked in, and inlined they would bloat the
 * stylesheet every page waits on. As files, a page fetches only the vines its
 * scheme shows, and Vite fingerprints and serves them like any other asset the
 * stylesheet names.
 *
 * Files are named by their own content, so they never go stale. They live
 * under `.astro/`, which is generated and not committed.
 */
export default function vines(): AstroIntegration {
    return {
        name: "vines",
        hooks: {
            "astro:config:setup": ({ config, updateConfig }) => {
                const dir = new URL(".astro/vines/", config.root);
                mkdirSync(dir, { recursive: true });

                const draw = (args: sass.Value[]) => {
                    const [ratio, seed, centred, leaf, flower] = args;
                    const svg = vine({
                        ratio: ratio!.assertNumber("ratio").value,
                        seed: seed!.assertNumber("seed").assertInt("seed"),
                        centred: centred!.isTruthy,
                        leaf: hex(leaf!.assertColor("leaf")),
                        flower: hex(flower!.assertColor("flower")),
                    });
                    const name = `${createHash("sha256").update(svg).digest("hex").slice(0, 16)}.svg`;
                    const file = fileURLToPath(new URL(name, dir));
                    if (!existsSync(file)) writeFileSync(file, svg);
                    return new sass.SassString(`url(/.astro/vines/${name})`, {
                        quotes: false,
                    });
                };

                updateConfig({
                    vite: {
                        css: {
                            preprocessorOptions: {
                                scss: {
                                    functions: {
                                        "vine($ratio, $seed, $centred, $leaf, $flower)":
                                            draw,
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

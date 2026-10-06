import type { AstroIntegration } from "astro";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pages as fixtures } from "../content/fixtures/tumblr";
import { parse, render } from "../tumblr/render";
import { stamp } from "../tumblr/stamp.mjs";

/**
 * Builds the Tumblr theme out of the site.
 *
 * The theme is a page like any other — src/tumblr/Theme.astro, on the site's
 * own shell and stylesheet — routed here so that `astro dev` shows it. After
 * the build it is turned into what Tumblr takes: one file, its stylesheet and
 * scripts inlined, anything else it needs addressed on this site by its full
 * URL, and stamped with its own hash. It is written to `dist-tumblr/` and
 * taken out of `dist/`, so the site never serves it.
 *
 * A fixture build also fills the theme in with sample posts, under
 * /fixtures/tumblr/, for the design suite to read.
 */

export const ROUTE = "tumblr-theme";

/**
 * What would stop the file working once Tumblr serves it, each with the
 * reason. The build fails on any of them rather than shipping a theme that
 * breaks on someone else's domain.
 */
const HAZARDS: [(html: string) => string | undefined, string][] = [
    [
        (html) => /(?:href|src)="\/(?!\/)|url\(\/(?!\/)/.exec(html)?.[0],
        "a root-relative URL, which would resolve against Tumblr",
    ],
    [
        (html) => /<astro-island/.exec(html)?.[0],
        "an island, whose scripts would be fetched from Tumblr",
    ],
    [
        (html) =>
            [...html.matchAll(/<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/g)]
                .map(([, , body]) => /\{[A-Za-z][\w-]*\}/.exec(body!)?.[0])
                .find(Boolean),
        "a {Word} inside a script or stylesheet, which Tumblr would replace",
    ],
];

/** Each stylesheet and module script the page links, set into it instead. */
async function inline(html: string, dist: URL): Promise<string> {
    const read = (path: string) => readFile(new URL(`.${path}`, dist), "utf8");
    let out = html;

    for (const [tag, path] of html.matchAll(
        /<link rel="stylesheet" href="(\/_astro\/[^"]+\.css)"\s*\/?>/g,
    ))
        out = out.replace(tag, `<style>${await read(path!)}</style>`);

    for (const [tag, path] of html.matchAll(
        /<script type="module" src="(\/_astro\/[^"]+\.js)"><\/script>/g,
    )) {
        const script = await read(path!);
        if (/^\s*import\b|\bimport\s*\(/m.test(script))
            throw new Error(
                `${path} imports another chunk; it cannot be inlined.`,
            );
        out = out.replace(tag, `<script type="module">${script}</script>`);
    }
    return out;
}

/** Root-relative URLs, made to name this site. */
const absolute = (html: string, site: URL) =>
    html.replace(/(?<=(?:href|src)="|url\()\/(?!\/)/g, site.origin + "/");

export default function tumblrTheme(): AstroIntegration {
    let site: URL;
    let root: URL;

    return {
        name: "tumblr-theme",
        hooks: {
            "astro:config:setup": ({ injectRoute }) => {
                injectRoute({
                    pattern: `/${ROUTE}`,
                    entrypoint: "./src/tumblr/Theme.astro",
                    prerender: true,
                });
            },
            "astro:config:done": ({ config }) => {
                if (!config.site)
                    throw new Error("The Tumblr theme needs `site` to be set.");
                site = new URL(config.site);
                root = config.root;
            },
            "astro:build:done": async ({ dir }) => {
                const page = new URL(`${ROUTE}/`, dir);
                const standalone = await inline(
                    await readFile(new URL("index.html", page), "utf8"),
                    dir,
                );
                await rm(page, { recursive: true });

                if (process.env.INCLUDE_FIXTURES) {
                    for (const [path, scope] of Object.entries(fixtures)) {
                        const out = new URL(`fixtures/${path}index.html`, dir);
                        await mkdir(dirname(fileURLToPath(out)), {
                            recursive: true,
                        });
                        await writeFile(out, render(standalone, scope));
                    }
                }

                const theme = absolute(standalone, site);
                parse(theme); // throws on a block opened or closed out of turn
                for (const [find, reason] of HAZARDS) {
                    const found = find(theme);
                    if (found)
                        throw new Error(
                            `The Tumblr theme contains ${reason}: ${found}`,
                        );
                }

                const out = new URL("dist-tumblr/theme.html", root);
                await mkdir(dirname(fileURLToPath(out)), { recursive: true });
                await writeFile(out, stamp(theme));
            },
        },
    };
}

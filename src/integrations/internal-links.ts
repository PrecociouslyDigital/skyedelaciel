import type { AstroIntegration } from "astro";
import { statSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { fromHtml } from "hast-util-from-html";
import { selectAll } from "hast-util-select";
import { SCHEDULED_PREFIX } from "../content/schedule";

/** One built page, by its path in the build, and where its links go. */
export interface BuiltPage {
    file: string;
    hrefs: string[];
}

/** Paths to the root of the build, such as `/fiction/` or `/rss.xml`. */
const rooted = (href: string) => /^\/(?!\/)/.test(href);

/**
 * Every root-relative link in `pages` that names nothing in the build, with
 * the page it is on.
 *
 * Fixtures are left alone: they link to missing pages on purpose, to show what
 * such a link looks like. A scheduled page may also name another scheduled
 * page by the path it will have once both are out.
 */
export function brokenLinks(
    pages: BuiltPage[],
    exists: (file: string) => boolean,
): string[] {
    const resolves = (path: string) =>
        [path, `${path}/index.html`, `${path}.html`].some(exists);

    return pages.flatMap(({ file, hrefs }) => {
        const route = file.replace(new RegExp(`^${SCHEDULED_PREFIX}/`), "");
        if (route.startsWith("fixtures/")) return [];
        const isScheduled = route !== file;
        return hrefs
            .filter(rooted)
            .filter((href) => {
                const path = href.replace(/[?#].*$/, "").replace(/\/$/, "");
                return !(
                    resolves(path) ||
                    (isScheduled && resolves(`/${SCHEDULED_PREFIX}${path}`))
                );
            })
            .map((href) => `${href} on /${file}`);
    });
}

/**
 * Fails the build on a link to a page of this site that was not built — in
 * particular, from a published page to one still scheduled.
 */
export default function internalLinks(): AstroIntegration {
    return {
        name: "internal-links",
        hooks: {
            "astro:build:done": async ({ dir }) => {
                const root = fileURLToPath(dir);
                const files = (await readdir(root, { recursive: true }))
                    .map((file) => file.replaceAll(sep, "/"))
                    .filter((file) => file.endsWith(".html"));
                const pages = await Promise.all(
                    files.map(async (file) => ({
                        file,
                        hrefs: selectAll(
                            "a[href]",
                            fromHtml(await readFile(join(root, file), "utf8")),
                        ).map(({ properties }) => String(properties.href)),
                    })),
                );
                const broken = brokenLinks(
                    pages,
                    (path) =>
                        statSync(join(root, path), {
                            throwIfNoEntry: false,
                        })?.isFile() ?? false,
                );
                if (broken.length > 0) {
                    throw new Error(
                        `Links to pages that were not built:\n${broken.join("\n")}`,
                    );
                }
            },
        },
    };
}

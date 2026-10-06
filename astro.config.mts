// @ts-check
import { execSync } from "node:child_process";
import { defineConfig } from "astro/config";
import * as R from "ramda";
import { match } from "ts-pattern";

import svelte from "@astrojs/svelte";

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import rehypeSlug from "rehype-slug";
import type { RemarkPlugin } from "@astrojs/markdown-remark";
import type { PluggableList } from "unified";

import { definitions } from "mdast-util-definitions";
import { visit } from "unist-util-visit";

import { resolveRemoteLinks } from "./src/components/mdx/links/resolve";
import { loadCache, saveCache } from "./src/components/mdx/links/cache";
import remarkSidenotes from "./src/plugins/remark-sidenotes";
import remarkSections from "./src/plugins/remark-sections";
import remarkFigures from "./src/plugins/remark-figures";
import { herbarium, tokenClasses } from "./src/plugins/herbarium";
import rehypeCodeBlocks from "./src/plugins/rehype-code-blocks";
import rehypeTaskLists from "./src/plugins/rehype-task-lists";
import tumblrTheme, {
    ROUTE as TUMBLR_THEME_ROUTE,
} from "./src/integrations/tumblr-theme";
import vines from "./src/integrations/vines";
import internalLinks from "./src/integrations/internal-links";
import { SCHEDULED_PREFIX } from "./src/content/schedule";

loadCache();

const extractLinks: RemarkPlugin = () => async (tree, file) => {
    const getDefinition = definitions(tree);
    const links: string[] = [];
    visit(tree, ["link", "linkReference"] as const, (node) => {
        match(node)
            .with({ type: "link" }, ({ url }) => links.push(url))
            .with({ type: "linkReference" }, ({ identifier }) => {
                const definition = getDefinition(identifier);
                if (definition) links.push(definition.url);
            })
            .exhaustive();
    });

    const linkMeta = await resolveRemoteLinks(links);
    saveCache();

    file.data.astro = R.mergeDeepWith(R.concat, file.data.astro, {
        frontmatter: {
            links,
            linkMeta,
        },
    });
};

/**
 * Which revision this build was made from, for the rail slug on every page.
 *
 * Not every build runs inside a git checkout, and that is never a reason to
 * fail one: the stamp degrades to nothing instead, and md.astro drops the
 * empty segment.
 */
function revision(): string {
    try {
        return execSync("git rev-parse --short HEAD", {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
    } catch {
        return "";
    }
}

/** What every page of prose is put through, Markdown and MDX alike. */
const remarkPlugins = [extractLinks];
const rehypePlugins = [rehypeSlug, rehypeCodeBlocks, rehypeTaskLists];

/**
 * What only MDX is put through: these write MDX components into the page,
 * which a plain Markdown page such as resume.md cannot render. Given its own
 * `remarkPlugins`, MDX drops Markdown's rather than extending them, so the
 * shared ones are restated.
 */
const mdxRemarkPlugins: PluggableList = [
    ...remarkPlugins,
    remarkSidenotes,
    remarkSections,
    [remarkFigures, { root: new URL("./", import.meta.url) }],
];

// https://astro.build/config
export default defineConfig({
    site: "https://skyedelaciel.com",
    // Served to the home network as well as this machine, under the name the
    // network knows it by.
    server: {
        host: true,
        allowedHosts: ["syhome.uwu"],
    },
    integrations: [
        mdx({ remarkPlugins: mdxRemarkPlugins }),
        svelte(),
        tumblrTheme(),
        vines(),
        // Only what a reader can reach: not the pages Access keeps to the
        // author, and not the theme, which the build moves out of `dist/`.
        sitemap({
            filter: (page) =>
                ![SCHEDULED_PREFIX, TUMBLR_THEME_ROUTE].some((prefix) =>
                    new URL(page).pathname.startsWith(`/${prefix}/`),
                ),
        }),
        internalLinks(),
    ],
    image: {
        // A link popover's image is copied onto this site at build time. Its
        // URL comes from resolving the link, never from a visitor, so any
        // https host is allowed.
        remotePatterns: [{ protocol: "https" }],
    },
    vite: {
        // A build fact, not a runtime one: baked in here so that a page can
        // carry it without every layout reaching for a shell.
        define: {
            __GIT_REVISION__: JSON.stringify(revision()),
        },
    },
    markdown: {
        // The theme names each token's kind instead of colouring it; the
        // transformer turns the names into classes for the stylesheet to ink.
        // See src/plugins/herbarium.ts.
        syntaxHighlight: "shiki",
        shikiConfig: { theme: herbarium, transformers: [tokenClasses] },
        remarkPlugins,
        rehypePlugins,
    },
});

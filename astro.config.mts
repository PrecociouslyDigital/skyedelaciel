// @ts-check
import { defineConfig } from "astro/config";
import * as R from "ramda";
import { match } from "ts-pattern";

import svelte from "@astrojs/svelte";

import mdx from "@astrojs/mdx";
import rehypeSlug from "rehype-slug";
import type { RemarkPlugin } from "@astrojs/markdown-remark";

import { definitions } from "mdast-util-definitions";
import { visit } from "unist-util-visit";

import { resolveRemoteLinks } from "./src/components/mdx/links/resolve";
import { loadCache, saveCache } from "./src/components/mdx/links/cache";
import remarkSidenotes from "./src/plugins/remark-sidenotes";
import rehypeCodeBlocks from "./src/plugins/rehype-code-blocks";

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

// https://astro.build/config
export default defineConfig({
    integrations: [mdx(), svelte()],
    markdown: {
        // Shiki would stamp its own theme's colours and background inline on
        // every code block, which no stylesheet can then re-ink for the reader's
        // scheme. Code is set in ink on paper like the rest of the page.
        syntaxHighlight: false,
        remarkPlugins: [extractLinks, remarkSidenotes],
        rehypePlugins: [rehypeSlug, rehypeCodeBlocks],
    },
});

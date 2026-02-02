// @ts-check
import { defineConfig } from "astro/config";
import * as R from "ramda";

import svelte from "@astrojs/svelte";

import mdx from "@astrojs/mdx";
import rehypeSlug from "rehype-slug";
import type { RemarkPlugin } from "@astrojs/markdown-remark";

import { definitions } from "mdast-util-definitions";
import { visit } from "unist-util-visit";

import { resolveLinkMeta } from "./src/components/links/resolve";
import { loadCache, saveCache } from "./src/components/links/cache";
import type { LinkEntry } from "./src/components/links/types";

loadCache();

const extractLinks: RemarkPlugin = () => async (tree, file) => {
    const getDefinition = definitions(tree);
    const links: string[] = [];
    visit(tree, ["link", "linkReference"], (node) => {
        switch (node.type) {
            case "link":
                links.push(node.url);
                break;
            case "linkReference": {
                const mbDef = getDefinition(node.identifier);
                if (mbDef != null) links.push(mbDef.url);
                break;
            }
        }
    });

    // Resolve metadata for each unique URL
    const unique = [...new Set(links)];
    const resolved = await Promise.all(
        unique.map((url) => resolveLinkMeta(url)),
    );
    const linkMeta: Record<string, LinkEntry> = {};
    for (let i = 0; i < unique.length; i++) {
        linkMeta[unique[i]] = resolved[i];
    }
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
        remarkPlugins: [extractLinks],
        rehypePlugins: [rehypeSlug],
    },
});

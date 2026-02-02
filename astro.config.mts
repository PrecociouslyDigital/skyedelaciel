// @ts-check
import { defineConfig } from "astro/config";
import * as R from "ramda";

import svelte from '@astrojs/svelte';


import mdx from "@astrojs/mdx";
import type { RemarkPlugin } from "@astrojs/markdown-remark";

import { definitions } from "mdast-util-definitions"
import { visit } from "unist-util-visit"

const extractLinks: RemarkPlugin = R.always((tree, file) => {
    const getDefinition = definitions(tree);
    const links: string[] = [];
    visit(tree, ["link", "linkReference"], (node) => {
        switch (node.type) {
            case 'link':
                links.push(node.url);
                break;
            case 'linkReference':
                const mbDef = getDefinition(node.identifier);
                if (mbDef != null) links.push(mbDef.url);
                break;
        }
    });
    file.data.astro = R.mergeDeepWith(R.concat, file.data.astro, {
        frontmatter: {
            links
        }
    });
});



// https://astro.build/config
export default defineConfig({
    integrations: [mdx(), svelte()],
    markdown: {
        remarkPlugins: [extractLinks]
    },
});

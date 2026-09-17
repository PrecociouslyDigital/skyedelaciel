/**
 * Rehype plugin: makes code blocks reachable from the keyboard.
 *
 * A <pre> that scrolls sideways is a scrollable region, and a scrollable region
 * a reader cannot focus is unreachable without a pointing device — axe reports
 * it as a serious violation, and it is one. Only `tabindex` can fix that, and
 * markdown gives no way to write an attribute onto a fence, so it is added
 * here rather than asked for at every call site.
 */
import type { RehypePlugin } from "@astrojs/markdown-remark";
import type { Root } from "hast";
import { visit } from "unist-util-visit";

const rehypeCodeBlocks: RehypePlugin = () => (tree: Root) => {
    visit(tree, "element", (node) => {
        if (node.tagName === "pre") node.properties.tabIndex = 0;
    });
};

export default rehypeCodeBlocks;

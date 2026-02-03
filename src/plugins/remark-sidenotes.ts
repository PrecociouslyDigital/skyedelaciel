/**
 * Remark plugin: transforms GFM footnotes into <Sidenote> MDX components.
 *
 * Collects footnoteDefinition nodes, replaces each footnoteReference with an
 * mdxJsxTextElement wrapping the definition's children, then removes the
 * definitions. CSS counters handle visible numbering, so the identifier is
 * used as-is (no index arithmetic).
 */
import type { RemarkPlugin } from "@astrojs/markdown-remark";
import { visit } from "unist-util-visit";
import type { Root, FootnoteDefinition } from "mdast";
import type { MdxJsxTextElement } from "mdast-util-mdx-jsx";

const remarkSidenotes: RemarkPlugin = () => (tree: Root) => {
    // 1. Collect footnote definitions keyed by identifier
    const defs = new Map<string, FootnoteDefinition["children"]>();
    visit(tree, "footnoteDefinition", (node: FootnoteDefinition) => {
        defs.set(node.identifier, node.children);
    });

    // 2. Replace each footnoteReference with a <Sidenote> element
    visit(tree, "footnoteReference", (node, index, parent) => {
        if (index == null || parent == null) return;
        const blocks = defs.get(node.identifier) ?? [];

        // Unwrap paragraph nodes to their inline children so we don't
        // introduce <p> tags inside the inline <span> wrapper.
        // Multiple paragraphs are separated by <br>.
        const inlineChildren: MdxJsxTextElement["children"] = [];
        for (const block of structuredClone(blocks)) {
            if (inlineChildren.length > 0) {
                inlineChildren.push({ type: "html", value: "<br/>" });
            }
            if (block.type === "paragraph") {
                inlineChildren.push(
                    ...(block.children as MdxJsxTextElement["children"]),
                );
            } else {
                // Non-paragraph blocks (code, lists, etc.) — keep as-is
                inlineChildren.push(
                    block as MdxJsxTextElement["children"][number],
                );
            }
        }

        const sidenote: MdxJsxTextElement = {
            type: "mdxJsxTextElement",
            name: "Sidenote",
            attributes: [
                {
                    type: "mdxJsxAttribute",
                    name: "id",
                    value: node.identifier,
                },
            ],
            children: inlineChildren,
        };

        parent.children.splice(index, 1, sidenote);
    });

    // 3. Remove all footnoteDefinition nodes
    visit(tree, "footnoteDefinition", (_node, index, parent) => {
        if (index == null || parent == null) return;
        parent.children.splice(index, 1);
        // Return index so visit re-checks the same position after splice
        return index;
    });
};

export default remarkSidenotes;

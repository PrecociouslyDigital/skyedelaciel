/**
 * Rehype plugin: names each task's checkbox after the task.
 *
 * Markdown's `- [x] task` renders a bare checkbox beside the task's words,
 * with nothing tying the two together, so a screen reader announces an
 * unnamed checkbox and axe reports it as a critical violation. The words are
 * not wrapped in a <label>, because a task may hold paragraphs, which a label
 * cannot. The box is given them as its name instead, less any list nested
 * under the task, whose items have boxes of their own.
 */
import type { RehypePlugin } from "@astrojs/markdown-remark";
import type { Element, Root } from "hast";
import { toString } from "hast-util-to-string";
import { visit } from "unist-util-visit";

const isList = (node: Element) => ["ul", "ol"].includes(node.tagName);

const rehypeTaskLists: RehypePlugin = () => (tree: Root) => {
    visit(tree, "element", (item) => {
        const classes = item.properties.className;
        if (!Array.isArray(classes) || !classes.includes("task-list-item"))
            return;
        const box = item.children.find(
            (child): child is Element =>
                child.type === "element" && child.tagName === "input",
        );
        if (!box) return;
        const words = item.children
            .filter((child) => !(child.type === "element" && isList(child)))
            .map((child) => toString(child))
            .join("")
            .replace(/\s+/g, " ")
            .trim();
        box.properties.ariaLabel = words;
    });
};

export default rehypeTaskLists;

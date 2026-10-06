/**
 * Remark plugin: numbers a page's headings as sections, 1, 1.1, 1.2, 2.
 *
 * The number travels as `data-section` on the heading, for Heading.astro to
 * set beside the words, and never in the heading's text, so slugs and the
 * table of contents read as they did. A heading that skips a level fails
 * the build where it stands.
 */
import type { RemarkPlugin } from "@astrojs/markdown-remark";
import type { Heading, Root } from "mdast";
import { visit } from "unist-util-visit";
import { SkippedLevel, sectionNumbers } from "./numbering";

const remarkSections: RemarkPlugin = () => (tree: Root, file) => {
    const headings: Heading[] = [];
    visit(tree, "heading", (heading) => {
        headings.push(heading);
    });
    if (headings.length === 0) return;

    let numbers: string[];
    try {
        numbers = sectionNumbers(headings.map((heading) => heading.depth));
    } catch (error) {
        if (error instanceof SkippedLevel)
            file.fail(error.message, headings[error.index]);
        throw error;
    }

    headings.forEach((heading, i) => {
        heading.data ??= {};
        heading.data.hProperties = {
            ...heading.data.hProperties,
            "data-section": numbers[i],
        };
    });
};

export default remarkSections;

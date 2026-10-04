import type { Element, ElementContent, Nodes } from "hast";
import { matches, select, selectAll } from "hast-util-select";
import { SKIP, visit } from "unist-util-visit";
import { parse, stringify, text } from "./html";
import type { Field } from "./types";

/** As many rows as a popover can show without the ledger becoming the page. */
export const MAX_FIELDS = 6;

/**
 * What an infobox carries for the article's own page and not for a popover:
 * footnote markers, edit links, template styles, and whatever the article
 * hides, whether with inline CSS or with Wikipedia's own stylesheet, as it
 * does a coordinate's second spelling. These have to go before sanitising,
 * which drops the `style` and `class` that kept the hidden ones hidden.
 */
const NOISE = [
    "sup.reference",
    ".noprint",
    ".geo-inline-hidden",
    ".geo-multi-punct",
    ".geo-nondefault",
    "style",
    "link",
    "[style*='display:none']",
    "[style*='display: none']",
].join(", ");

const separator = (): ElementContent => ({ type: "text", value: ", " });

/** Remove every node matching `selector` from the tree. */
function strip(tree: Nodes, selector: string): void {
    visit(tree, "element", (node, index, parent) => {
        if (parent === undefined || index === undefined) return;
        if (!matches(selector, node)) return;
        parent.children.splice(index, 1);
        return [SKIP, index];
    });
}

/**
 * Lay a cell out on one line: a ledger's value sits beside its label, so the
 * line breaks and lists an infobox stacks values with become commas.
 */
function flatten(cell: Element): void {
    visit(cell, "element", (node, index, parent) => {
        if (parent === undefined || index === undefined) return;
        if (node.tagName === "br") {
            parent.children.splice(index, 1, separator());
            return index;
        }
        if (node.tagName === "ul" || node.tagName === "ol") {
            const items = node.children.filter(
                (child): child is Element =>
                    child.type === "element" && child.tagName === "li",
            );
            parent.children.splice(
                index,
                1,
                ...items.flatMap((item, i) =>
                    i === 0 ? item.children : [separator(), ...item.children],
                ),
            );
            // Revisit from here, so a list nested in an item flattens too.
            return index;
        }
        return undefined;
    });
}

/**
 * Parsoid writes article links relative to the article (`./Linyi`), which
 * would resolve against this site instead.
 */
function absolutise(cell: Element, base: string): void {
    visit(cell, "element", (node) => {
        const href = node.properties.href;
        if (node.tagName !== "a" || typeof href !== "string") return;
        try {
            node.properties.href = new URL(href, base).href;
        } catch {
            delete node.properties.href;
        }
    });
}

/** A break at either end of a cell leaves a separator with nothing beyond it. */
const trimSeparators = (html: string): string =>
    html.replace(/^[\s,]+|[\s,]+$/g, "");

/**
 * The labelled rows of the first infobox in a Wikipedia article, as Parsoid
 * renders it, in the article's order and capped at `MAX_FIELDS`.
 *
 * Only rows with both a label and a value are kept, which leaves out the
 * infobox's own title, image, caption and section headers. Only the
 * infobox's own rows are read, never those of a sub-box nested in one.
 *
 * Values are cleaned but not sanitised: like a summary, they are sanitised
 * where the popover is built, whichever way they arrived.
 *
 * @param base the article's URL, which the values' links are relative to
 */
export function infoboxFields(html: string, base: string): Field[] {
    const table = select("table.infobox", parse(html));
    if (!table) return [];

    return selectAll(":scope > tbody > tr, :scope > tr", table)
        .flatMap((row): Field[] => {
            const label = select(":scope > th.infobox-label", row);
            const value = select(":scope > td.infobox-data", row);
            if (!label || !value) return [];

            strip(value, NOISE);
            flatten(value);
            absolutise(value, base);

            const field = {
                label: text(label),
                value: trimSeparators(
                    stringify({ type: "root", children: value.children }),
                ),
            };
            return field.label && text(value) ? [field] : [];
        })
        .slice(0, MAX_FIELDS);
}

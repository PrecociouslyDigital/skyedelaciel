import { fromHtml } from "hast-util-from-html";
import { sanitize } from "hast-util-sanitize";
import type { Schema } from "hast-util-sanitize";
import { select } from "hast-util-select";
import { toHtml } from "hast-util-to-html";
import { toString } from "hast-util-to-string";
import type { Nodes } from "hast";
import { visit } from "unist-util-visit";

/**
 * Remote HTML — a Wikipedia extract, an OpenGraph description, a hand-written
 * override — reaches the page through `set:html`, so it is parsed and
 * sanitised here rather than pattern-matched as a string.
 */

/** Parse a fragment of HTML. */
export const parse = (html: string): Nodes =>
    fromHtml(html, { fragment: true });

/** Serialise a tree back to HTML. */
export const stringify = (tree: Nodes): string => toHtml(tree);

/** The text a tree would render as, with runs of whitespace collapsed. */
export const text = (tree: Nodes): string =>
    toString(tree).replace(/\s+/g, " ").trim();

/**
 * What a popover summary may contain: phrasing content, and the paragraphs
 * `inlineSummary` flattens into it.
 */
export const summarySchema: Schema = {
    tagNames: [
        "a",
        "abbr",
        "b",
        "br",
        "code",
        "em",
        "i",
        "p",
        "q",
        "s",
        "span",
        "strong",
        "sub",
        "sup",
        "time",
        "u",
        "wbr",
    ],
    attributes: {
        a: ["href", "title"],
        time: ["dateTime"],
        abbr: ["title"],
        // No global attributes.
        "*": [],
    },
    // A summary's links leave the site; they are not endorsements.
    required: { a: { rel: "nofollow noopener noreferrer" } },
    protocols: { href: ["http", "https", "mailto"] },
    strip: ["script", "style", "iframe", "object", "embed", "form", "template"],
    clobber: [],
};

/** Element renames, applied in place. */
const rename = (tree: Nodes, from: string, to: string): void => {
    visit(tree, "element", (node) => {
        if (node.tagName === from) node.tagName = to;
    });
};

/**
 * A summary, safe to hand to `set:html` and legal inside a paragraph.
 *
 * The popover lays its body out on one flow, so paragraphs become spans —
 * the words themselves are untouched.
 */
export function inlineSummary(html: string): string {
    const tree = sanitize(parse(html), summarySchema);
    rename(tree, "p", "span");
    return stringify(tree);
}

/** The document's `<title>`, for a page that offered no better metadata. */
export function documentTitle(html: string): string | undefined {
    const title = select("title", parse(html));
    if (!title) return undefined;
    const content = text(title);
    return content === "" ? undefined : content;
}

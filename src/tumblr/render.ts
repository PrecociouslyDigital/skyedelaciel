import { VARIABLES } from "./tags";

/**
 * Enough of Tumblr's renderer to fill the theme in with sample posts, so the
 * design suite can read a page of the blog without Tumblr. Its parser is also
 * what proves every block in the theme is closed, and closed in order.
 *
 * Tumblr's rules, as far as this theme leans on them: a block is repeated for
 * a list, kept for any other truthy value, and dropped otherwise. A name is
 * looked up in the innermost scope that has it, so a post's `Title` hides the
 * blog's — and a post with no title must say `Title: false`, or it would
 * show the blog's. A variable Tumblr knows but the scope does not is empty;
 * a brace that is not one of Tumblr's is left as it is.
 */

export type Value = string | boolean | Scope[];
export interface Scope {
    [name: string]: Value;
}

type Node =
    | string
    | { variable: string; source: string }
    | { block: string; children: Node[] };

const TAG = /\{(\/?block:)?([A-Za-z][\w-]*)\}/g;
const KNOWN: ReadonlySet<string> = new Set(VARIABLES);

/** The template as a tree, or an error naming the first misplaced block. */
export function parse(template: string): Node[] {
    const root: Node[] = [];
    const open: { block: string; children: Node[] }[] = [];
    const here = () => open.at(-1)?.children ?? root;
    let from = 0;

    for (const match of template.matchAll(TAG)) {
        const [source, kind, name] = match as unknown as [
            string,
            string | undefined,
            string,
        ];
        here().push(template.slice(from, match.index));
        from = match.index + source.length;

        if (kind === "block:") {
            const node = { block: name, children: [] };
            here().push(node);
            open.push(node);
        } else if (kind === "/block:") {
            const closing = open.pop();
            if (closing?.block !== name)
                throw new Error(
                    `{/block:${name}} closes ${closing ? `{block:${closing.block}}` : "nothing"}.`,
                );
        } else {
            here().push({ variable: name, source });
        }
    }

    const unclosed = open.at(-1);
    if (unclosed) throw new Error(`{block:${unclosed.block}} is never closed.`);
    here().push(template.slice(from));
    return root;
}

function lookup(name: string, scopes: Scope[]): Value | undefined {
    return scopes.findLast((scope) => name in scope)?.[name];
}

function fill(nodes: Node[], scopes: Scope[]): string {
    return nodes
        .map((node) => {
            if (typeof node === "string") return node;
            if ("variable" in node) {
                const value = lookup(node.variable, scopes);
                if (typeof value === "string") return value;
                return KNOWN.has(node.variable) ? "" : node.source;
            }
            const value = lookup(node.block, scopes);
            if (Array.isArray(value))
                return value
                    .map((item) => fill(node.children, [...scopes, item]))
                    .join("");
            return value ? fill(node.children, scopes) : "";
        })
        .join("");
}

/** The template as Tumblr would serve it for `page`. */
export const render = (template: string, page: Scope) =>
    fill(parse(template), [page]);

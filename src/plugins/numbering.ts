/**
 * How a page's apparatus is numbered. Pure functions, so the remark plugins
 * that apply them stay thin and the numbering can be tested as properties.
 */
import { slug } from "github-slugger";

/** A heading at a level the one before it does not open. */
export class SkippedLevel extends Error {
    constructor(
        /** Which heading, in document order. */
        readonly index: number,
        readonly depth: number,
        readonly expected: number,
    ) {
        super(
            `a heading of depth ${depth} follows one that only opens depth ${expected}: a level was skipped, so it has no section number.`,
        );
    }
}

/**
 * The section number of each heading, from their depths in document order:
 * "1", "1.1", "1.2", "2", "2.1.1", and so on.
 *
 * The top level is the shallowest depth the page uses, so a page whose
 * headings start at `##` numbers those 1, 2 and 3. A heading may close any
 * number of levels but open only one, so that every number names a section
 * that exists. A heading that opens more throws `SkippedLevel`.
 */
export function sectionNumbers(depths: readonly number[]): string[] {
    const top = Math.min(...depths);
    const counts: number[] = [];
    return depths.map((depth, index) => {
        const level = depth - top;
        if (level > counts.length)
            throw new SkippedLevel(index, depth, top + counts.length);
        counts.length = level + 1;
        counts[level] = (counts[level] ?? 0) + 1;
        return counts.join(".");
    });
}

/**
 * What a page sets apart from its running text, each numbered in its own
 * sequence and anchored by its own prefix: "Figure 2" is `#fig-fuji`.
 */
export type Kind = "figure" | "table" | "listing";

export const KINDS: Record<
    Kind,
    {
        /** What an id starts with, before the hyphen. */
        prefix: string;
        /** How the text names one: "Figure 2". */
        label: string;
        /** How its own caption names it: "Fig. 2". */
        short: string;
    }
> = {
    figure: { prefix: "fig", label: "Figure", short: "Fig." },
    table: { prefix: "tab", label: "Table", short: "Table" },
    listing: { prefix: "lst", label: "Listing", short: "Listing" },
};

/**
 * A thing set apart, named for its id: a figure by its file, a table or a
 * listing by its caption. Only a listing may lack a name; it is then known
 * by its number alone and cannot be cited.
 */
export type Apparatus =
    | { kind: Exclude<Kind, "listing">; name: string }
    | { kind: "listing"; name?: string };

export type Numbered = Apparatus & { id: string; number: number };

/** Two things on one page whose names come to the same id. */
export class DuplicateId extends Error {
    constructor(
        /** The second of them, in document order. */
        readonly index: number,
        readonly id: string,
    ) {
        super(
            `two things on this page would both be #${id}; rename one of them.`,
        );
    }
}

/** A link to a figure, table or listing the page does not have, or cannot cite. */
export class DanglingReference extends Error {
    constructor(
        readonly href: string,
        reason = "names nothing on this page",
    ) {
        super(`${href} ${reason}.`);
    }
}

/**
 * Each thing's id and number: numbered from 1 in document order, each kind
 * on its own, and identified by its kind's prefix and the slug of its name,
 * or its number if it has none. Throws `DuplicateId` where two would share
 * an id.
 */
export function numberApparatus(items: readonly Apparatus[]): Numbered[] {
    const counts = new Map<Kind, number>();
    const ids = new Set<string>();
    return items.map((item, index) => {
        const number = (counts.get(item.kind) ?? 0) + 1;
        counts.set(item.kind, number);
        const id = `${KINDS[item.kind].prefix}-${item.name ? slug(item.name) : number}`;
        if (ids.has(id)) throw new DuplicateId(index, id);
        ids.add(id);
        return { ...item, id, number };
    });
}

/** Whether `href` is a link to apparatus at all, of any kind. */
export const namesApparatus = (href: string) =>
    Object.values(KINDS).some(({ prefix }) => href.startsWith(`#${prefix}-`));

/** What a link to `href` reads as: "Figure 2". */
export function referenceText(numbered: readonly Numbered[], href: string) {
    const target = numbered.find(({ id }) => `#${id}` === href);
    if (!target) throw new DanglingReference(href);
    // An untitled listing's id is its number, so adding a listing above it changes the id.
    if (!target.name)
        throw new DanglingReference(
            href,
            "is an untitled listing, which cannot be cited; give its fence a title",
        );
    return `${KINDS[target.kind].label} ${target.number}`;
}

/** What a thing's own caption calls it: "Fig. 2". */
export const captionLabel = ({ kind, number }: Numbered) =>
    `${KINDS[kind].short} ${number}`;

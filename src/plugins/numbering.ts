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
 * What a page sets apart from its running text, each anchored by its own
 * prefix: "Figure 3.2" is `#fig-fuji`. They are numbered on two tracks,
 * figures and statements, so that no number names two things on one track.
 */
export type Kind = "figure" | "table" | "definition" | "lemma" | "theorem";

export type Track = "figures" | "statements";

export const KINDS: Record<
    Kind,
    {
        /** Which sequence it is numbered in. */
        track: Track;
        /** What an id starts with, before the hyphen. */
        prefix: string;
        /** How the text names one: "Figure 3.2". */
        label: string;
        /** How its own caption or heading names it: "Fig. 3.2". */
        short: string;
    }
> = {
    figure: { track: "figures", prefix: "fig", label: "Figure", short: "Fig." },
    table: { track: "figures", prefix: "tab", label: "Table", short: "Table" },
    definition: {
        track: "statements",
        prefix: "def",
        label: "Definition",
        short: "Def.",
    },
    lemma: {
        track: "statements",
        prefix: "lem",
        label: "Lemma",
        short: "Lemma",
    },
    theorem: {
        track: "statements",
        prefix: "thm",
        label: "Theorem",
        short: "Theorem",
    },
};

/**
 * A thing set apart, named for its id: an image by its file, a block of code
 * or a table by its caption, a definition by its term, a lemma or theorem by
 * the name it is given. A block of code, a lemma and a theorem may go
 * without; one is then known by its number alone and cannot be cited.
 *
 * `section` is the number of the top-level section it stands in, if it
 * stands in one.
 */
export type Apparatus = (
    | { kind: "figure" | "lemma" | "theorem"; name?: string }
    | { kind: "table" | "definition"; name: string }
) & { section?: string };

export type Numbered = Apparatus & { id: string; number: string };

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

/** A link to apparatus the page does not have, or cannot cite. */
export class DanglingReference extends Error {
    constructor(
        readonly href: string,
        reason = "names nothing on this page",
    ) {
        super(`${href} ${reason}.`);
    }
}

/**
 * Each thing's id and number. Each track is numbered from 1 within each
 * top-level section, after the section's own number: "3.1", "3.2", then
 * "4.1". Anything before the first section is numbered plainly, "1", "2".
 *
 * A thing is identified by its kind's prefix and the slug of its name, or of
 * its number if it has none. Throws `DuplicateId` where two would share an id.
 */
export function numberApparatus(items: readonly Apparatus[]): Numbered[] {
    const counts = new Map<string, number>();
    const ids = new Set<string>();
    return items.map((item, index) => {
        const { track, prefix } = KINDS[item.kind];
        const counter = `${track} ${item.section ?? ""}`;
        const n = (counts.get(counter) ?? 0) + 1;
        counts.set(counter, n);
        const number = item.section ? `${item.section}.${n}` : `${n}`;
        const id = `${prefix}-${slug(item.name ?? number.replaceAll(".", "-"))}`;
        if (ids.has(id)) throw new DuplicateId(index, id);
        ids.add(id);
        return { ...item, id, number };
    });
}

/** Whether `href` is a link to apparatus at all, of any kind. */
export const namesApparatus = (href: string) =>
    Object.values(KINDS).some(({ prefix }) => href.startsWith(`#${prefix}-`));

/** What a link to `href` reads as: "Figure 3.2". */
export function referenceText(numbered: readonly Numbered[], href: string) {
    const target = numbered.find(({ id }) => `#${id}` === href);
    if (!target) throw new DanglingReference(href);
    // An unnamed thing's id is its number, so adding one above it changes the id.
    if (!target.name)
        throw new DanglingReference(
            href,
            "has no name, so it cannot be cited; give its fence a title, or the lemma or theorem a name",
        );
    return `${KINDS[target.kind].label} ${target.number}`;
}

/** What a thing's own caption or heading calls it: "Fig. 3.2". */
export const captionLabel = ({ kind, number }: Numbered) =>
    `${KINDS[kind].short} ${number}`;

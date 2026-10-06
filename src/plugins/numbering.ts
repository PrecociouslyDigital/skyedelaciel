/**
 * How a page's apparatus is numbered. Pure functions, so the remark plugins
 * that apply them stay thin and the numbering can be tested as properties.
 */

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

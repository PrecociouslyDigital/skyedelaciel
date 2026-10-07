/**
 * The levels a table of contents nests to. A page's headings deeper than the
 * last are left out of it.
 */
export const TOC_LEVELS = [1, 2, 3] as const;

export type TocLevel = (typeof TOC_LEVELS)[number];

/** The deepest heading a table of contents lists. */
export const TOC_DEPTH = TOC_LEVELS.length;

/** A heading in a table of contents, with the headings it holds. */
export interface TocNode {
    slug: string;
    text: string;
    level: TocLevel;
    children: TocNode[];
}

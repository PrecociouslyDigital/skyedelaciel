import { internalId } from "~/components/mdx/links/resolve";

/**
 * A section is a directory with an `index.mdx`: that file is the section's
 * page, at the directory's path, and every article under the directory is
 * one of the section's pieces. See design.mdx, Section pages.
 */

/** As much of an article as a list of pieces reads. */
export interface Piece {
    id: string;
    data: { published: Date };
}

/** Whether the article `id` is one of the section `section`'s pieces. */
export const isIn = (section: string, id: string) =>
    id.startsWith(`${section}/`);

/** Latest first; the order every list of pieces on the site is in. */
export const newestFirst = <P extends Piece>(pieces: P[]): P[] =>
    pieces.toSorted(
        (a, b) => b.data.published.getTime() - a.data.published.getTime(),
    );

/** The pieces that belong to any of `sections`, latest first. */
export const sectioned = <P extends Piece>(
    pieces: P[],
    sections: { id: string }[],
): P[] =>
    newestFirst(
        pieces.filter((piece) =>
            sections.some((section) => isIn(section.id, piece.id)),
        ),
    );

/**
 * What a section page's Everything Else lists: the section's pieces that the
 * page, as written, does not already link to.
 */
export function everythingElse<P extends Piece>(
    section: string,
    links: string[],
    pieces: P[],
): P[] {
    const linked = new Set(links.map(internalId));
    return newestFirst(
        pieces.filter(
            (piece) => isIn(section, piece.id) && !linked.has(piece.id),
        ),
    );
}

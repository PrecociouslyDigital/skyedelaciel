/**
 * The components remark plugins write into a page, and the props each takes.
 * The plugins build their nodes against this, and each component takes its
 * `Props` from it, so the two cannot disagree about a prop.
 *
 * A prop the page imports (an image, a drawing's URL) is written by the
 * plugin as the identifier it imported it under, and received by the
 * component as the value: `Written<"written">` is what a plugin writes, and
 * `Written` is what a component receives.
 */
import type { ImageMetadata } from "astro";
import type { IdOf } from "../../plugins/numbering";

/** An identifier the page has imported, to pass as a prop by reference. */
export interface Imported {
    identifier: string;
}

type Side = "written" | "received";

/** A value the page imports, as `S` sees it. */
type Import<S extends Side, T> = S extends "written" ? Imported : T;

export interface Written<S extends Side = "received"> {
    Figure: {
        id: IdOf<"figure">;
        /** "Fig. 3.2". */
        label: string;
        image: Import<S, ImageMetadata>;
        alt: string;
        /** The URL of its plate's drawing. */
        plate: Import<S, string>;
        /** How wide the image is drawn, in px. */
        width: number;
    };
    CodeFigure: {
        id: IdOf<"figure">;
        label: string;
        caption?: string;
        lang: string;
        lines: number;
    };
    TableFigure: {
        id: IdOf<"table">;
        label: string;
    };
    Term: {
        id: IdOf<"definition">;
        label: string;
    };
    Statement: {
        id: IdOf<"lemma" | "theorem">;
        label: string;
        name?: string;
    };
    Sidenote: {
        /** A slug, not a number: CSS counters number the notes. */
        id: string;
    };
}

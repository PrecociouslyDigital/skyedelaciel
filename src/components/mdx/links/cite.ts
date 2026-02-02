// @ts-expect-error — citeproc has no type declarations
import CSL from "citeproc";
import type { CslDate, LinkEntry } from "./types";
import mlaStyle from "./mla.csl?raw";
import enUSLocale from "./locale-en-US.xml?raw";

/**
 * Build a citeproc engine for a single CSL-JSON item.
 * One engine per call keeps the registry clean.
 */
function makeEngine(item: LinkEntry["csl"]) {
    const sys = {
        retrieveItem: () => item,
        retrieveLocale: () => enUSLocale,
    };
    return new CSL.Engine(sys, mlaStyle, "en-US");
}

/** Wrap the entry's URL in a span so CSS can hide it on screen, show on print. */
function wrapUrl(html: string, url?: string) {
    if (!url) return html;
    return html.replace(`${url}.`, `<span class="cite-url">${url}.</span>`);
}

/** Format a LinkEntry as an MLA bibliography string via citeproc-js. */
export function formatCitation(entry: LinkEntry): string {
    const engine = makeEngine(entry.csl);
    engine.updateItems([entry.csl.id]);
    const [, entries]: [unknown, string[]] = engine.makeBibliography();
    return wrapUrl(entries[0]?.trim() ?? "", entry.csl.URL);
}


/** Format CSL date-parts into a human-readable string. */
export const formatCslDate = (date: CslDate | undefined): string => {
    if(date == null) return "";
    const parts = date["date-parts"]?.[0];
    if (!parts?.length) return date.literal ?? date.raw ?? "";
    const [year, month, day] = parts.map(Number);
    // Build date from available granularity
    if (month && day)
        return new Date(year, month - 1, day).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    if (month)
        return new Date(year, month - 1).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
        });
    return String(year);
};

/** Format a CSL author name object into a display string. */
export const formatAuthor = (
    a: { given?: string; family?: string; literal?: string } | undefined,
): string | undefined =>
    a?.literal ??
    (a?.given && a?.family ? `${a.given} ${a.family}` : a?.family);

/** Comma-separated author list. */
export const authorLine = (entry: LinkEntry): string => {
    const authors = entry.csl.author;
    if (!authors?.length) return "";
    return authors.map(formatAuthor).filter(Boolean).join(", ");
};

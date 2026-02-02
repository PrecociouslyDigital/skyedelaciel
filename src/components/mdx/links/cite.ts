import { Cite } from "@citation-js/core";
import "@citation-js/plugin-csl";
import type { LinkEntry } from "./types";

/** Format a LinkEntry as a bibliography string via Citation.js. */
export function formatCitation(entry: LinkEntry): string {
    const cite = new Cite([entry.csl]);
    return cite
        .format("bibliography", {
            format: "html",
            template: "apa",
            lang: "en-US",
        })
        .trim()
        .replace(/\s*\(n\.d\.\)\.?/, "");
}

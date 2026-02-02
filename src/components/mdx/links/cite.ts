// @ts-expect-error — citeproc has no type declarations
import CSL from "citeproc";
import type { LinkEntry } from "./types";
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

/** Format a LinkEntry as an MLA bibliography string via citeproc-js. */
export function formatCitation(entry: LinkEntry): string {
    const engine = makeEngine(entry.csl);
    engine.updateItems([entry.csl.id]);
    const [, entries]: [unknown, string[]] = engine.makeBibliography();
    return entries[0]?.trim().replace(/\s*\(n\.d\.\)\.?/, "") ?? "";
}

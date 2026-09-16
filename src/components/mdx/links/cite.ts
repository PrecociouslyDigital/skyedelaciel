// @ts-expect-error — citeproc has no type declarations
import CSL from "citeproc";
import { match, P } from "ts-pattern";
import type { CslData, CslDate, CslName } from "./types";
import mlaStyle from "./mla.csl?raw";
import enUSLocale from "./locale-en-US.xml?raw";

/**
 * Build a citeproc engine for a single CSL-JSON item.
 * One engine per call keeps the registry clean.
 */
function makeEngine(item: CslData) {
    const sys = {
        retrieveItem: () => item,
        retrieveLocale: () => enUSLocale,
    };
    return new CSL.Engine(sys, mlaStyle, "en-US");
}

/** Wrap the item's URL in a span so CSS can hide it on screen, show on print. */
const wrapUrl = (html: string, url: string) =>
    html.replace(`${url}.`, `<span class="cite-url">${url}.</span>`);

/** Format a CSL item as an MLA bibliography string via citeproc-js. */
export function formatCitation(csl: CslData): string {
    const engine = makeEngine(csl);
    engine.updateItems([csl.id]);
    const [, entries]: [unknown, string[]] = engine.makeBibliography();
    const formatted = entries[0]?.trim() ?? "";
    return csl.URL ? wrapUrl(formatted, csl.URL) : formatted;
}

/** One cell of a CSL date-parts array: a year, month or day. */
type DatePart = string | number;

/** Render a date at whatever granularity the caller supplies. */
const formatDate = (year: DatePart, month?: DatePart, day?: DatePart) =>
    new Date(
        Number(year),
        Number(month ?? 1) - 1,
        Number(day ?? 1),
    ).toLocaleDateString("en-US", {
        year: "numeric",
        ...(month !== undefined && { month: "long" }),
        ...(day !== undefined && { day: "numeric" }),
    });

/**
 * Format a CSL date. The three date-parts granularities are distinguished by
 * the *shape* of the array, so a genuine month of zero can't read as absent.
 */
export const formatCslDate = (date: CslDate | undefined): string | undefined =>
    match(date)
        .with({ "date-parts": [[P._, P._, P._]] }, ({ "date-parts": [p] }) =>
            formatDate(p[0], p[1], p[2]),
        )
        .with({ "date-parts": [[P._, P._]] }, ({ "date-parts": [p] }) =>
            formatDate(p[0], p[1]),
        )
        .with({ "date-parts": [[P._]] }, ({ "date-parts": [[year]] }) =>
            String(year),
        )
        .with({ literal: P.string }, (d) => d.literal)
        .with({ raw: P.string }, (d) => d.raw)
        .otherwise(() => undefined);

/** Format a CSL name object into a display string. */
export const formatAuthor = (name: CslName): string | undefined =>
    name.literal ??
    match([name.given, name.family])
        .with([P.string, P.string], ([given, family]) => `${given} ${family}`)
        .with([P._, P.string], ([, family]) => family)
        .otherwise(() => undefined);

/** Comma-separated author list. */
export const authorLine = (csl: CslData): string | undefined => {
    const names = csl.author
        ?.map(formatAuthor)
        .filter((name) => name !== undefined);
    return names?.length ? names.join(", ") : undefined;
};

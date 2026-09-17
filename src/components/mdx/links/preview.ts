import { match } from "ts-pattern";
import { inlineSummary } from "./html";
import { sourceOf } from "./sources";
import type { LinkEntry, Summary } from "./types";

/** The contents of a link's hover popover, in render order. */
export interface Preview {
    title: string;
    meta: string[];
    body?: Summary;
    image?: string;
}

/**
 * An html summary is third-party markup on its way to `set:html`, so it is
 * sanitised and flattened to inline here. Plain text goes to `set:text` and
 * needs neither.
 */
const inline = (body: Summary): Summary =>
    match(body)
        .with({ type: "html" }, ({ type, content }) => ({
            type,
            content: inlineSummary(content),
        }))
        .with({ type: "text" }, (text) => text)
        .exhaustive();

/**
 * Everything the hover popover shows, per the "Popover" section of the design
 * spec. What each kind of link contributes is declared by its source.
 *
 * A link with no title gets no popover — there would be nothing to head it
 * with — and neither does one we failed to look up.
 */
export function buildPreview(entry: LinkEntry): Preview | undefined {
    const title = entry.csl.title;
    if (title === undefined) return undefined;
    if (entry.resolution === "unresolved") return undefined;

    const source = sourceOf(entry.kind);
    return {
        title,
        meta: source.meta(entry.csl).filter((field) => field !== undefined),
        body: entry.summary && inline(entry.summary),
        ...(source.image && entry.imageUrl && { image: entry.imageUrl }),
    };
}

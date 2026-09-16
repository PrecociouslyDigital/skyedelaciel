import { match, P } from "ts-pattern";
import { authorLine, formatCslDate } from "./cite";
import type { LinkEntry, Summary } from "./types";

/** The contents of a link's hover popover, in render order. */
export interface Preview {
    title: string;
    meta: string[];
    body?: Summary;
    image?: string;
}

/**
 * Summaries arrive as block HTML, but the popover lays its body out inline —
 * so paragraphs become spans. Plain-text bodies pass through untouched.
 */
const inline = (body: Summary): Summary =>
    match(body)
        .with({ type: "html" }, ({ type, content }) => ({
            type,
            content: content
                .replaceAll("<p>", "<span>")
                .replaceAll("</p>", "</span>"),
        }))
        .with({ type: "text" }, (text) => text)
        .exhaustive();

/**
 * Everything the hover popover shows, per the "Popover" section of the design
 * spec: what each kind of link contributes is decided here and nowhere else.
 *
 * A link with no title gets no popover — there would be nothing to head it with.
 */
export function buildPreview(entry: LinkEntry): Preview | undefined {
    const { csl } = entry;
    const title = csl.title;
    if (title === undefined) return undefined;

    return match(entry)
        .with({ resolution: "unresolved" }, () => undefined)
        .with({ kind: "internal" }, ({ summary }) => ({
            title,
            meta: [csl["container-title"]].filter((m) => m !== undefined),
            body: summary && inline(summary),
        }))
        .with({ kind: "wikipedia" }, ({ summary, imageUrl }) => ({
            title,
            meta: [],
            body: summary && inline(summary),
            image: imageUrl,
        }))
        .with(
            { kind: P.union("doi", "external") },
            ({ summary, imageUrl }) => ({
                title,
                meta: [
                    authorLine(csl),
                    csl["container-title"],
                    formatCslDate(csl.issued),
                ].filter((m) => m !== undefined),
                body: summary && inline(summary),
                image: imageUrl,
            }),
        )
        .exhaustive();
}

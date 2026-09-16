import type { LinkEntry, LinkMeta } from "./types";

/**
 * Page-level context a <Link> needs but can't derive from its own href, set
 * by the route before the page renders.
 *
 * The bibliography flag lets print decide whether to cite a link into the
 * Works Referenced section, which a link alone has no way to know.
 */
export interface LinkContext {
    meta: LinkMeta;
    bibliography: boolean;
}

let context: LinkContext = { meta: {}, bibliography: false };

export function setLinkContext(next: LinkContext): void {
    context = next;
}

export function getLinkMeta(url: string): LinkEntry | undefined {
    return context.meta[url];
}

export function hasBibliography(): boolean {
    return context.bibliography;
}

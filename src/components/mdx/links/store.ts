import type { LinkEntry, LinkMeta } from "./types";

/** Module-level store for per-page link metadata, set before render. */
let store: LinkMeta = {};

export function setLinkMeta(meta: LinkMeta): void {
    store = meta;
}

export function getLinkMeta(url: string): LinkEntry | undefined {
    return store[url];
}

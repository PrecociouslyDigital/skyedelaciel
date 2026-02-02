import type { LinkEntry } from "./types";

/** Module-level store for per-page link metadata, set before render. */
let store: Record<string, LinkEntry> = {};

export function setLinkMeta(meta: Record<string, LinkEntry>): void {
    store = meta;
}

export function getLinkMeta(url: string): LinkEntry | undefined {
    return store[url];
}

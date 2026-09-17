import type { LinkEntry, LinkKind, LinkMeta } from "./types";
import { getCached, setCached } from "./cache";
import { todayParts } from "./cite";
import type { Source } from "./sources";
import { SITE_NAME, sourceFor } from "./sources";

/** A page of this site, as far as a link to it is concerned. */
export interface InternalPage {
    title: string;
    abstract: string;
}

/** All we can say about a link we couldn't look up: where it points. */
const unresolved = (url: string, kind: LinkKind): LinkEntry => ({
    resolution: "unresolved",
    kind,
    csl: { type: "webpage", id: url, URL: url, accessed: todayParts() },
});

/** A link whose source is fetched, carrying the resolver that fetches it. */
interface RemoteLink {
    url: string;
    kind: LinkKind;
    resolve: NonNullable<Source["resolve"]>;
}

/** Resolve one remote URL, using the cache when it holds a fresh entry. */
async function resolveRemote({
    url,
    kind,
    resolve,
}: RemoteLink): Promise<LinkEntry> {
    const cached = getCached(url);
    if (cached) return cached;

    try {
        const entry = await resolve(url);
        setCached(url, entry);
        return entry;
    } catch {
        // Failures are deliberately not cached: a transient network error
        // would otherwise stand in for the real metadata for a full TTL.
        return unresolved(url, kind);
    }
}

/**
 * Resolve every link in a document that has to be fetched. Skips sources
 * with no `resolve`; those are this site's own pages, handled separately by
 * `resolveInternalLinks`.
 */
export async function resolveRemoteLinks(urls: string[]): Promise<LinkMeta> {
    const remote = [...new Set(urls)].flatMap((url): RemoteLink[] => {
        const { kind, resolve } = sourceFor(url);
        return resolve ? [{ url, kind, resolve }] : [];
    });
    return Object.fromEntries(
        await Promise.all(
            remote.map(async (link) => [link.url, await resolveRemote(link)]),
        ),
    );
}

/**
 * Resolve the internal links in a document against this site's own pages.
 * A link to a page we don't have — a bare "#section" fragment, say — gets no
 * entry at all, and so renders without a popover.
 */
export function resolveInternalLinks(
    urls: string[],
    pages: Map<string, InternalPage>,
): LinkMeta {
    const entries = [...new Set(urls)].flatMap((url) => {
        if (sourceFor(url).kind !== "internal") return [];
        const page = pages.get(url.replace(/^\//, "").replace(/[#?].*$/, ""));
        if (!page) return [];
        const entry: LinkEntry = {
            resolution: "resolved",
            kind: "internal",
            csl: {
                type: "webpage",
                id: url,
                URL: url,
                title: page.title,
                "container-title": SITE_NAME,
            },
            summary: { type: "text", content: page.abstract },
        };
        return [[url, entry] as const];
    });
    return Object.fromEntries(entries);
}

import type { LinkEntry, LinkKind, LinkMeta } from "./types";
import { getCached, setCached } from "./cache";
import { todayParts } from "./cite";
import type { RemoteSource } from "./sources";
import { SITE_HOST, SITE_NAME, sourceFor } from "./sources";

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
    resolve: RemoteSource["resolve"];
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
 * Resolve every link in a document that has to be fetched: all but this
 * site's own pages, which `resolveInternalLinks` handles.
 */
export async function resolveRemoteLinks(urls: string[]): Promise<LinkMeta> {
    const remote = [...new Set(urls)].flatMap((url): RemoteLink[] => {
        const source = sourceFor(url);
        return source.kind === "internal"
            ? []
            : [{ url, kind: source.kind, resolve: source.resolve }];
    });
    return Object.fromEntries(
        await Promise.all(
            remote.map(async (link) => [link.url, await resolveRemote(link)]),
        ),
    );
}

/**
 * The id of the content entry an internal link names, which is its path with
 * no slashes at either end, or undefined for a link that leaves the site.
 * Collection ids are how a page is looked up; the route is built from them.
 */
export function internalId(url: string): string | undefined {
    if (sourceFor(url).kind !== "internal") return undefined;
    return new URL(url, `https://${SITE_HOST}`).pathname.replace(
        /^\/+|\/+$/g,
        "",
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
        const id = internalId(url);
        const page = id === undefined ? undefined : pages.get(id);
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

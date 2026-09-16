import ogs from "open-graph-scraper";
import { match } from "ts-pattern";
import * as z from "zod";
import type {
    CslDate,
    LinkEntry,
    LinkKind,
    LinkMeta,
    ResolvedLink,
} from "./types";
import { cslData } from "./types";
import { getCached, setCached } from "./cache";

const SITE_HOST = "skyedelaciel.com";
const SITE_NAME = "Skye De La Ciel";

/** Kinds that have to be fetched. Internal links are resolved from the collection. */
type RemoteKind = Exclude<LinkKind, "internal">;

/** A page of this site, as far as a link to it is concerned. */
export interface InternalPage {
    title: string;
    abstract: string;
}

/** Classify a URL into one of the known link kinds. */
function classify(url: string): LinkKind {
    try {
        const parsed = new URL(url, `https://${SITE_HOST}`);
        if (!parsed.hostname || parsed.hostname === SITE_HOST)
            return "internal";
        // DOIs always begin with the "10." prefix
        if (
            parsed.hostname.includes("doi.org") &&
            /^\/10\./.test(parsed.pathname)
        )
            return "doi";
        if (parsed.hostname.endsWith(".wikipedia.org")) return "wikipedia";
    } catch {
        // Unparseable URLs (bare fragments, etc.) are internal
        return "internal";
    }
    return "external";
}

/** Extract a DOI from a doi.org URL. */
const extractDoi = (url: string): string =>
    url.match(/doi\.org\/(.+)/)?.[1] ?? url;

/** Extract a Wikipedia article title from a URL. */
function extractWikiTitle(url: string): string {
    const encoded = url.match(/wikipedia\.org\/wiki\/(.+)/)?.[1];
    return encoded ? decodeURIComponent(encoded).replace(/_/g, " ") : url;
}

/** Today as a CSL date-parts value. */
const todayParts = (): CslDate => {
    const d = new Date();
    return {
        "date-parts": [[d.getFullYear(), d.getMonth() + 1, d.getDate()]],
    };
};

/**
 * Parse a date string into CSL form. Unparseable input is kept as CSL's own
 * `raw` variant rather than becoming a date made of NaNs.
 */
const parseCslDate = (s: string): CslDate => {
    if (Number.isNaN(Date.parse(s))) return { raw: s };
    const d = new Date(s);
    return {
        "date-parts": [
            [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()],
        ],
    };
};

/** The fields we use from Wikipedia's REST summary endpoint. */
const wikipediaSummary = z.object({
    title: z.string(),
    timestamp: z.string().optional(),
    extract_html: z.string().optional(),
    thumbnail: z.object({ source: z.string() }).optional(),
});

async function resolveDoi(url: string): Promise<ResolvedLink> {
    const res = await fetch(
        `https://api.crossref.org/works/${extractDoi(url)}`,
        { headers: { Accept: "application/vnd.citationstyles.csl+json" } },
    );
    const csl = await z.parseAsync(cslData, await res.json());
    return {
        resolution: "resolved",
        kind: "doi",
        csl,
        ...(csl.abstract && {
            summary: { type: "text", content: csl.abstract },
        }),
    };
}

async function resolveWikipedia(url: string): Promise<ResolvedLink> {
    const lang = url.match(/(\w+)\.wikipedia/)?.[1] ?? "en";
    const title = encodeURIComponent(extractWikiTitle(url));
    const res = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${title}`,
    );
    const data = wikipediaSummary.parse(await res.json());
    return {
        resolution: "resolved",
        kind: "wikipedia",
        csl: {
            type: "webpage",
            id: url,
            URL: url,
            title: data.title,
            "container-title": "Wikipedia",
            ...(data.timestamp && { issued: parseCslDate(data.timestamp) }),
        },
        ...(data.extract_html && {
            summary: { type: "html", content: data.extract_html },
        }),
        ...(data.thumbnail && { imageUrl: data.thumbnail.source }),
    };
}

async function resolveExternal(url: string): Promise<ResolvedLink> {
    const { result, html } = await ogs({ url });

    // Fallback: extract <title> from raw HTML when OG/DC tags are absent
    const title =
        result.ogTitle ??
        result.dcTitle ??
        result.twitterTitle ??
        html?.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
    const author =
        result.author ?? result.articleAuthor ?? result.ogArticleAuthor;
    const date = result.ogDate ?? result.dcDate;
    const description = result.ogDescription ?? result.dcDescription;
    const image = result.ogImage?.[0];

    return {
        resolution: "resolved",
        kind: "external",
        csl: {
            type: "webpage",
            id: url,
            URL: url,
            title,
            "container-title": result.ogSiteName,
            ...(author && { author: [{ family: author }] }),
            ...(date && { issued: parseCslDate(date) }),
            accessed: todayParts(),
        },
        ...(description && {
            summary: { type: "text", content: description },
        }),
        ...(image && { imageUrl: image.url }),
    };
}

/** All we can say about a link we couldn't look up: where it points. */
const unresolved = (url: string, kind: LinkKind): LinkEntry => ({
    resolution: "unresolved",
    kind,
    csl: { type: "webpage", id: url, URL: url, accessed: todayParts() },
});

/** Resolve one remote URL, using the cache when it holds a fresh entry. */
async function resolveRemote(
    url: string,
    kind: RemoteKind,
): Promise<LinkEntry> {
    const cached = getCached(url);
    if (cached) return cached;

    try {
        const entry = await match(kind)
            .with("doi", () => resolveDoi(url))
            .with("wikipedia", () => resolveWikipedia(url))
            .with("external", () => resolveExternal(url))
            .exhaustive();
        setCached(url, entry);
        return entry;
    } catch {
        // Failures are deliberately not cached: a transient network error
        // would otherwise stand in for the real metadata for a full TTL.
        return unresolved(url, kind);
    }
}

/**
 * Resolve every link in a document that has to be fetched. Internal links are
 * skipped here; they are resolved at render time from the page collection.
 */
export async function resolveRemoteLinks(urls: string[]): Promise<LinkMeta> {
    const remote = [...new Set(urls)].flatMap((url) => {
        const kind = classify(url);
        return kind === "internal" ? [] : [[url, kind] as const];
    });
    return Object.fromEntries(
        await Promise.all(
            remote.map(async ([url, kind]) => [
                url,
                await resolveRemote(url, kind),
            ]),
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
        if (classify(url) !== "internal") return [];
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

import ogs from "open-graph-scraper";
import type { LinkKind, LinkEntry, CslData, CslDate } from "./types";
import { getCached, setCached } from "./cache";

/** Classify a URL into one of the known link kinds. */
function classify(url: string): LinkKind {
    try {
        const parsed = new URL(url, "https://skyedelaciel.com");
        if (!parsed.hostname || parsed.hostname === "skyedelaciel.com")
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
function extractDoi(url: string): string {
    const m = url.match(/doi\.org\/(.+)/);
    return m ? m[1] : url;
}

/** Extract a Wikipedia article title from a URL. */
function extractWikiTitle(url: string): string {
    const m = url.match(/wikipedia\.org\/wiki\/(.+)/);
    return m ? decodeURIComponent(m[1]).replace(/_/g, " ") : url;
}

/** Today as a CSL date-parts value. */
const todayParts = (): CslDate => {
    const d = new Date();
    return {
        "date-parts": [[d.getFullYear(), d.getMonth() + 1, d.getDate()]],
    };
};

/** Parse a "YYYY-MM-DD" (or partial) string into CSL date-parts. */
const parseDateParts = (s: string): CslDate => {
    const date = new Date(s);
    return {
        "date-parts": [
            [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDay()],
        ],
    };
};

async function resolveDoi(url: string): Promise<LinkEntry> {
    const doi = extractDoi(url);
    try {
        const res = await fetch(`https://api.crossref.org/works/${doi}`);
        const data = await res.json();
        const work = data.message;
        const authors = (work.author ?? []).map(
            (a: { given?: string; family?: string }) => ({
                family: a.family ?? "",
                given: a.given,
            }),
        );
        const csl: CslData = {
            type: "article-journal",
            id: url,
            URL: url,
            title: work.title?.[0],
            "container-title": work["container-title"]?.[0],
            ...(authors.length && { author: authors }),
            ...(work.created?.["date-parts"]?.[0] && {
                issued: {
                    "date-parts": [work.created["date-parts"][0]],
                },
            }),
            accessed: todayParts(),
        };
        return { csl, kind: "doi" };
    } catch {
        return {
            csl: {
                type: "article-journal",
                id: url,
                URL: url,
                accessed: todayParts(),
            },
            kind: "doi",
        };
    }
}

async function resolveWikipedia(url: string): Promise<LinkEntry> {
    const title = extractWikiTitle(url);
    try {
        const lang = url.match(/(\w+)\.wikipedia/)?.[1] ?? "en";
        const res = await fetch(
            `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        );
        const data = await res.json();
        return {
            csl: {
                type: "webpage",
                id: url,
                URL: url,
                title: data.title,
                "container-title": "Wikipedia",
                issued: parseDateParts(data.timestamp),
            },
            kind: "wikipedia",
            summary: data.extract_html
                .replace("<p>", "<span>")
                .replace("</p>", "</span>"),
            imageUrl: data.thumbnail?.source,
        };
    } catch {
        return {
            csl: {
                type: "webpage",
                id: url,
                URL: url,
                title,
                "container-title": "Wikipedia",
                accessed: todayParts(),
            },
            kind: "wikipedia",
        };
    }
}

async function resolveExternal(url: string): Promise<LinkEntry> {
    try {
        const { result, html } = await ogs({ url });

        // Fallback: extract <title> from raw HTML when OG/DC tags are absent
        const title =
            result.ogTitle ??
            result.dcTitle ??
            result.twitterTitle ??
            html?.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();

        const author =
            result.author ?? result.articleAuthor ?? result.ogArticleAuthor;

        const csl: CslData = {
            type: "webpage",
            id: url,
            URL: url,
            title,
            "container-title": result.ogSiteName,
            ...(author && {
                author: [{ family: author }],
            }),
            ...((result.ogDate ?? result.dcDate) && {
                issued: parseDateParts(result.ogDate ?? result.dcDate!),
            }),
            accessed: todayParts(),
        };
        return {
            csl,
            kind: "external",
            summary: result.ogDescription ?? result.dcDescription,
            imageUrl: result.ogImage?.[0]?.url,
        };
    } catch {
        return {
            csl: { type: "webpage", id: url, URL: url, accessed: todayParts() },
            kind: "external",
        };
    }
}
/**
 * Resolve metadata for a URL, using cache when available.
 * Internal links are resolved from the provided page data.
 */
export async function resolveLinkMeta(
    url: string,
    internalPages?: Map<
        string,
        { title: string; authors?: string[]; abstract?: string }
    >,
): Promise<LinkEntry> {
    // Check cache first
    const cached = getCached(url);
    if (cached) return cached;

    const kind = classify(url);
    let entry: LinkEntry;

    switch (kind) {
        case "internal": {
            const slug = url.replace(/^\//, "");
            const page = internalPages?.get(slug);
            entry = {
                csl: {
                    type: "webpage",
                    id: url,
                    URL: url,
                    title: page?.title,
                },
                kind: "internal",
                summary: page?.abstract,
            };
            break;
        }
        case "doi":
            entry = await resolveDoi(url);
            break;
        case "wikipedia":
            entry = await resolveWikipedia(url);
            break;
        case "external":
            entry = await resolveExternal(url);
            break;
    }

    setCached(url, entry);
    return entry;
}

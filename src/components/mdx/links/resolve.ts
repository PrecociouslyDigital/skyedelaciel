import ogs from "open-graph-scraper";
import type { Data, Date as CslDate, Person } from "csl-json";
import type { LinkKind, LinkEntry } from "./types";
import { getCached, setCached } from "./cache";

/** Classify a URL into one of the known link kinds. */
function classify(url: string): LinkKind {
    try {
        const parsed = new URL(url, "https://skyedelaciel.com");
        if (!parsed.hostname || parsed.hostname === "skyedelaciel.com")
            return "internal";
        if (parsed.hostname.includes("doi.org")) return "doi";
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
    const [y, m, d] = s.split("-").map(Number);
    return { "date-parts": [[y, m, d]] };
};

async function resolveDoi(url: string): Promise<LinkEntry> {
    const doi = extractDoi(url);
    try {
        const res = await fetch(`https://api.crossref.org/works/${doi}`);
        const data = await res.json();
        const work = data.message;
        const authors: Person[] = (work.author ?? []).map(
            (a: { given?: string; family?: string }) => ({
                family: a.family ?? "",
                given: a.given,
            }),
        );
        const csl: Data = {
            type: "article-journal",
            id: url,
            URL: url,
            title: work.title?.[0],
            "container-title": work["container-title"]?.[0],
            ...(authors.length && { author: authors }),
            ...(work.created?.["date-parts"]?.[0] && {
                issued: {
                    "date-parts": [work.created["date-parts"][0]],
                } as CslDate,
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
                accessed: todayParts(),
            },
            kind: "wikipedia",
            summary: data.extract,
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
        const { result } = await ogs({ url });
        const csl: Data = {
            type: "webpage",
            id: url,
            URL: url,
            title: result.ogTitle ?? result.dcTitle,
            "container-title": result.ogSiteName,
            ...(result.author && {
                author: [{ family: result.author } as Person],
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

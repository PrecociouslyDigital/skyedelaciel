import ogs from "open-graph-scraper";
import * as z from "zod";
import { authorLine, formatCslDate, parseCslDate, todayParts } from "./cite";
import { toCsl } from "./crossref";
import { documentTitle } from "./html";
import type { CslData, LinkEntry, LinkKind, ResolvedLink } from "./types";

export const SITE_HOST = "skyedelaciel.com";
export const SITE_NAME = "Skye De La Ciel";

/**
 * Everything true of one kind of link: which URLs it owns, how to resolve
 * it, and what its popover and bibliography entry may say. Classification,
 * resolution, the popover, and the bibliography each dispatch by reading
 * this instead of testing `kind` themselves.
 */
export interface Source {
    readonly kind: LinkKind;

    /** Does this source own the URL? The registry's order breaks ties. */
    readonly claims: (url: URL) => boolean;

    /**
     * Look the link up. Absent for a source that is not fetched — this site's
     * own pages are resolved from the page collection instead.
     */
    readonly resolve?: (url: string) => Promise<ResolvedLink>;

    /** The popover's metadata line, in order. Undefined entries are dropped. */
    readonly meta: (csl: CslData) => (string | undefined)[];

    /** Whether a link of this kind is a work to cite. */
    readonly citable: boolean;

    /** Whether the popover may show a lead image when one resolved. */
    readonly image: boolean;
}

/** The full apparatus of a published work: who, where, when. */
const workMeta = (csl: CslData) => [
    authorLine(csl),
    csl["container-title"],
    formatCslDate(csl.issued),
];

const internal: Source = {
    kind: "internal",
    claims: (url) => url.hostname === SITE_HOST,
    // design.mdx, Internal Pages: title, abstract and site name, nothing else.
    meta: (csl) => [csl["container-title"]],
    citable: false,
    image: false,
};

const CSL_JSON = "application/vnd.citationstyles.csl+json";

/**
 * Where to ask about a DOI, in order. Crossref is the richer source for most
 * journal articles, but only knows its own DOIs — `10.48550/arXiv.*` is a
 * DataCite DOI, and Crossref 404s on it. doi.org's content negotiation reaches
 * every registrar, so it's the fallback.
 */
const doiEndpoints = (doi: string): string[] => [
    `https://api.crossref.org/works/${doi}/transform/${CSL_JSON}`,
    `https://doi.org/${doi}`,
];

/**
 * Extract a DOI from a doi.org URL. A query string or fragment on the link is
 * the reader's business, not part of the identifier.
 */
const extractDoi = (url: string): string =>
    url.match(/doi\.org\/(.+)/)?.[1]?.replace(/[?#].*$/, "") ?? url;

const doi: Source = {
    kind: "doi",
    // DOIs always begin with the "10." prefix.
    claims: (url) =>
        url.hostname.includes("doi.org") && /^\/10\./.test(url.pathname),
    resolve: async (url) => {
        for (const endpoint of doiEndpoints(extractDoi(url))) {
            try {
                const res = await fetch(endpoint, {
                    headers: { Accept: CSL_JSON },
                });
                if (!res.ok) continue;

                const csl = toCsl(await res.json(), url);
                return {
                    resolution: "resolved",
                    kind: "doi",
                    csl,
                    ...(csl.abstract && {
                        summary: { type: "text", content: csl.abstract },
                    }),
                };
            } catch {
                // A refused connection, a body that isn't JSON, metadata that
                // won't normalise: none of them are answers either, so they
                // fall through to the next registrar the way a 404 does.
                continue;
            }
        }
        throw new Error(`no registrar answered for ${url}`);
    },
    meta: workMeta,
    citable: true,
    image: true,
};

/** The fields we use from Wikipedia's REST summary endpoint. */
const wikipediaSummary = z.object({
    title: z.string(),
    timestamp: z.string().optional(),
    extract_html: z.string().optional(),
    thumbnail: z.object({ source: z.string() }).optional(),
});

/** Extract a Wikipedia article title from a URL. */
function extractWikiTitle(url: string): string {
    const encoded = url.match(/wikipedia\.org\/wiki\/(.+)/)?.[1];
    return encoded ? decodeURIComponent(encoded).replace(/_/g, " ") : url;
}

const wikipedia: Source = {
    kind: "wikipedia",
    claims: (url) => url.hostname.endsWith(".wikipedia.org"),
    resolve: async (url) => {
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
    },
    // An encyclopedia article has no author line to show.
    meta: () => [],
    citable: true,
    image: true,
};

const external: Source = {
    kind: "external",
    // The fallback: whatever no other source claimed.
    claims: () => true,
    resolve: async (url) => {
        const { result, html } = await ogs({ url });

        // Fallback: the document's own <title> when OG/DC tags are absent.
        const title =
            result.ogTitle ??
            result.dcTitle ??
            result.twitterTitle ??
            (html === undefined ? undefined : documentTitle(html));
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
    },
    meta: workMeta,
    citable: true,
    image: true,
};

/**
 * Every source, keyed by kind. `Record<LinkKind, Source>` makes a kind
 * missing here, or one that no longer exists, a compile error.
 */
const byKind: Record<LinkKind, Source> = {
    internal,
    doi,
    wikipedia,
    external,
};

/**
 * Claiming order, most specific first. `external` claims every URL, so it is
 * appended last here rather than trusted to sit last above — a source written
 * below it there would otherwise never be reached, and the symptom would be a
 * popover quietly showing the wrong fields.
 */
const claimants: readonly Source[] = [
    ...Object.values(byKind).filter((source) => source !== external),
    external,
];

/** Which source owns a URL. Unparseable input is one of this site's own. */
export function sourceFor(url: string): Source {
    let parsed: URL;
    try {
        parsed = new URL(url, `https://${SITE_HOST}`);
    } catch {
        // Bare fragments and the like are internal.
        return internal;
    }
    if (!parsed.hostname) return internal;
    return claimants.find((source) => source.claims(parsed)) ?? external;
}

export const sourceOf = (kind: LinkKind): Source => byKind[kind];

/**
 * Whether a link points to a citable work rather than a page of this site.
 * The bibliography and the printed citations must agree on this, so both call
 * this instead of checking `entry.kind` on their own.
 */
export const isCitable = (entry: LinkEntry): boolean =>
    sourceOf(entry.kind).citable;

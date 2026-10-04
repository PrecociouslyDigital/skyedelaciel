import ogs from "open-graph-scraper";
import type { OgObject } from "open-graph-scraper/types";
import * as z from "zod";
import { authorLine, formatCslDate, parseCslDate, todayParts } from "./cite";
import { toCsl } from "./crossref";
import { documentTitle } from "./html";
import { infoboxFields } from "./infobox";
import { memoise } from "./memo";
import type { LinkEntry, LinkKind, ResolvedLink } from "./types";

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
     * The glyph a link of this kind wears in the margin of its own text, so a
     * reader can see where it leads without following it. One character, and
     * borrowed from the apparatus of a printed page rather than invented.
     */
    readonly mark: string;

    /**
     * Look the link up. Absent for a source that is not fetched — this site's
     * own pages are resolved from the page collection instead.
     */
    readonly resolve?: (url: string) => Promise<ResolvedLink>;

    /** The popover's metadata line, in order. Undefined entries are dropped. */
    readonly meta: (entry: ResolvedLink) => (string | undefined)[];

    /** Whether a link of this kind is a work to cite. */
    readonly citable: boolean;

    /** Whether the popover may show a lead image when one resolved. */
    readonly image: boolean;
}

/** The full apparatus of a published work: who, where, when. */
const workMeta = ({ csl }: ResolvedLink) => [
    authorLine(csl),
    csl["container-title"],
    formatCslDate(csl.issued),
];

const internal: Source = {
    kind: "internal",
    claims: (url) => url.hostname === SITE_HOST,
    // The section mark: another part of the same work.
    mark: "§",
    // design.mdx, Internal Pages: title, abstract and site name, nothing else.
    meta: ({ csl }) => [csl["container-title"]],
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
 * The identifier in an arXiv abstract or PDF link, in either of the schemes
 * arXiv has used: `1706.03762` since 2007, `hep-th/9901001` before. A version
 * suffix is left out, since a DOI names the paper rather than a revision.
 */
const ARXIV_PATH =
    /^\/(?:abs|pdf)\/(\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?(?:\.pdf)?\/?$/;

const arxivId = (url: URL): string | undefined =>
    /(^|\.)arxiv\.org$/.test(url.hostname)
        ? ARXIV_PATH.exec(url.pathname)?.[1]
        : undefined;

/**
 * The DOI a link names. A query string or fragment on a doi.org link is the
 * reader's business, not part of the identifier. An arXiv link names the DOI
 * arXiv registers for every paper with DataCite.
 */
function extractDoi(url: string): string {
    const id = arxivId(new URL(url));
    if (id !== undefined) return `10.48550/arXiv.${id}`;
    return url.match(/doi\.org\/(.+)/)?.[1]?.replace(/[?#].*$/, "") ?? url;
}

const doi: Source = {
    kind: "doi",
    // DOIs always begin with the "10." prefix.
    claims: (url) =>
        (url.hostname.includes("doi.org") && /^\/10\./.test(url.pathname)) ||
        arxivId(url) !== undefined,
    // The pilcrow: a published passage, with an identifier of its own.
    mark: "¶",
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

const wikipediaImage = z.object({ source: z.string() });

/** The fields we use from Wikipedia's REST summary endpoint. */
const wikipediaSummary = z.object({
    title: z.string(),
    timestamp: z.string().optional(),
    description: z.string().optional(),
    extract_html: z.string().optional(),
    thumbnail: wikipediaImage.optional(),
    originalimage: wikipediaImage.optional(),
});

/** Extract a Wikipedia article title from a URL. */
function extractWikiTitle(url: string): string {
    const encoded = url.match(/wikipedia\.org\/wiki\/(.+)/)?.[1];
    return encoded ? decodeURIComponent(encoded).replace(/_/g, " ") : url;
}

const isSvg = (src: string): boolean =>
    new URL(src).pathname.toLowerCase().endsWith(".svg");

/**
 * The article's image at full size, which the build scales itself. An SVG
 * original is the exception: the build can't rasterise one, so it takes the
 * thumbnail, which Wikipedia has already rasterised.
 */
const leadImage = ({
    originalimage,
    thumbnail,
}: z.infer<typeof wikipediaSummary>): string | undefined =>
    originalimage && !isSvg(originalimage.source)
        ? originalimage.source
        : thumbnail?.source;

const wikipedia: Source = {
    kind: "wikipedia",
    claims: (url) => url.hostname.endsWith(".wikipedia.org"),
    mark: "W",
    resolve: async (url) => {
        const lang = url.match(/(\w+)\.wikipedia/)?.[1] ?? "en";
        const title = encodeURIComponent(extractWikiTitle(url));
        const api = `https://${lang}.wikipedia.org/api/rest_v1/page`;

        // The summary endpoint has already cleaned the lead of references,
        // pronunciations and coordinates. The page itself is fetched only for
        // its infobox, which the summary doesn't carry, and a page that won't
        // load costs the ledger and nothing else.
        const [data, fields] = await Promise.all([
            fetch(`${api}/summary/${title}`)
                .then((res) => res.json())
                .then((json) => wikipediaSummary.parse(json)),
            fetch(`${api}/html/${title}`)
                .then((res) => (res.ok ? res.text() : ""))
                .then((html) => infoboxFields(html, url))
                .catch(() => []),
        ]);
        const image = leadImage(data);

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
            ...(data.description && { description: data.description }),
            ...(fields.length > 0 && { fields }),
            ...(image && { imageUrl: image }),
        };
    },
    // An encyclopedia article has no author line to show, but it does say
    // what its subject is.
    meta: ({ description }) => [description],
    citable: true,
    image: true,
};

/**
 * Hosts whose OpenGraph images are generated cards: the page's title set in
 * type on a template, which says nothing the popover's own title doesn't.
 */
const CARD_GENERATORS: ReadonlySet<string> = new Set([
    "opengraph.githubassets.com",
]);

/** A page's OpenGraph image, as an absolute URL. */
const ogImage = (result: OgObject, page: string): string | undefined => {
    const image = result.ogImage?.[0]?.url;
    if (image === undefined) return undefined;
    try {
        const absolute = new URL(image, page);
        absolute.hash = "";
        return absolute.href;
    } catch {
        return undefined;
    }
};

/**
 * Each origin's homepage image, looked up once per build however many of its
 * pages are linked.
 */
const homepageImage = memoise(
    (origin): Promise<string | undefined> =>
        ogs({ url: origin })
            .then(({ result }) => ogImage(result, origin))
            .catch(() => undefined),
);

/**
 * A page's image, unless it is one that would tell the reader nothing: a
 * generated title card, or the site's logo, which a site puts on every page
 * that has no image of its own, its homepage included.
 */
async function pageImage(
    result: OgObject,
    page: string,
): Promise<string | undefined> {
    const image = ogImage(result, page);
    if (image === undefined) return undefined;
    if (CARD_GENERATORS.has(new URL(image).hostname)) return undefined;
    if (image === (await homepageImage(new URL(page).origin))) return undefined;
    return image;
}

const external: Source = {
    kind: "external",
    // The fallback: whatever no other source claimed.
    claims: () => true,
    // An arrow off the page, for the one kind of link that leaves it.
    mark: "↗",
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
        const image = await pageImage(result, url);

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
            ...(image && { imageUrl: image }),
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

/**
 * Whether anything is known about what is at the other end of a link.
 *
 * `resolution` is a property of the lookup rather than of the URL, so it is a
 * separate question from `sourceFor` — a link of any kind can come back
 * unknown. Two cases share the answer: a lookup that failed, and a link no
 * lookup ever produced an entry for, which is what a path to a page that does
 * not exist leaves behind.
 *
 * A same-document fragment is the exception, and not an oversight: it
 * addresses the page the reader is already on, so there was never anything to
 * look up and nothing is missing.
 */
export const isResolved = (
    href: string,
    entry: LinkEntry | undefined,
): boolean => href.startsWith("#") || entry?.resolution === "resolved";

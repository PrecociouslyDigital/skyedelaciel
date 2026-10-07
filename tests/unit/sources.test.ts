import { describe, expect, test, vi } from "vitest";
import {
    isCitable,
    isResolved,
    sourceFor,
    sourceOf,
} from "~/components/mdx/links/sources";
import type { LinkEntry, LinkKind } from "~/components/mdx/links/types";
import { linkKind } from "~/components/mdx/links/types";

/**
 * Which source owns which URL, including the edge cases that a predicate
 * written too broadly would otherwise swallow.
 */
const OWNERSHIP: Record<string, LinkKind> = {
    // This site's own pages, however they are written.
    "/design": "internal",
    "/design#popover": "internal",
    "#section": "internal",
    "https://skyedelaciel.com/design": "internal",

    "https://doi.org/10.1038/s41586-021-03819-2": "doi",
    "https://dx.doi.org/10.1145/3442188.3445922": "doi",
    // An arXiv DOI is still a DOI, and the registrar ladder is what reaches it.
    "https://doi.org/10.48550/arXiv.1706.03762": "doi",
    // doi.org itself is a website, not an identifier: no "10." prefix.
    "https://doi.org": "external",
    "https://doi.org/about": "external",

    "https://en.wikipedia.org/wiki/Dyson_sphere": "wikipedia",
    "https://de.wikipedia.org/wiki/Dyson-Sph%C3%A4re": "wikipedia",

    // arXiv registers a DataCite DOI for every paper, so its abstract and PDF
    // links are DOIs in all but spelling.
    "https://arxiv.org/abs/1706.03762": "doi",
    "https://arxiv.org/pdf/1706.03762v7": "doi",
    "https://arxiv.org/abs/hep-th/9901001": "doi",
    // The rest of arXiv is a website.
    "https://arxiv.org/list/cs.CL/recent": "external",
    "https://arxiv.org/abs/": "external",

    "https://example.com/a": "external",
};

describe("sourceFor", () => {
    test.each(Object.entries(OWNERSHIP))("%s is %s", (url, kind) => {
        expect(sourceFor(url).kind).toBe(kind);
    });

    /**
     * Lookup has to be total: every link on a page gets a source, including
     * the malformed ones, because the alternative is a build that throws on
     * a typo in someone's prose.
     */
    test("it is total, even over input that is not a URL", () => {
        for (const url of ["", "   ", "not a url", "http://", "://x", "%%%"]) {
            expect(linkKind.options).toContain(sourceFor(url).kind);
        }
    });
});

describe("the registry", () => {
    test("every kind resolves to the source that declares it", () => {
        for (const kind of linkKind.options) {
            expect(sourceOf(kind).kind).toBe(kind);
        }
    });

    /**
     * Internal pages are resolved elsewhere, so they are the one source with
     * no resolver here.
     */
    test("the only source that is not fetched is this site's own", () => {
        const unfetched = linkKind.options.filter(
            (kind) => !("resolve" in sourceOf(kind)),
        );
        expect(unfetched).toEqual(["internal"]);
    });

    /**
     * `Record<LinkKind, Source>` already makes a kind without a mark a compile
     * error. What it cannot see is two kinds wearing the same one, which would
     * leave a reader unable to tell them apart with nothing going red.
     */
    test("no two kinds wear the same provenance mark", () => {
        const marks = linkKind.options.map((kind) => sourceOf(kind).mark);
        expect(new Set(marks).size).toBe(marks.length);
    });
});

/**
 * Whether a link is known is a question about the lookup, not about the URL,
 * and the two sit next to each other everywhere a link is rendered — so the
 * cases where they come apart are worth pinning.
 */
describe("isResolved", () => {
    const entry = (resolution: LinkEntry["resolution"]): LinkEntry => ({
        resolution,
        kind: "external",
        csl: { type: "webpage", id: "https://example.com/a" },
    });

    test("a lookup that answered", () => {
        expect(isResolved("https://example.com/a", entry("resolved"))).toBe(
            true,
        );
    });

    test("a lookup that failed", () => {
        expect(isResolved("https://example.com/a", entry("unresolved"))).toBe(
            false,
        );
    });

    test("a link no lookup ever produced an entry for", () => {
        expect(isResolved("/not-a-page", undefined)).toBe(false);
    });

    test("a fragment of this page, which was never looked up", () => {
        expect(isResolved("#colors", undefined)).toBe(true);
    });
});

/**
 * Crossref is the richer source but only knows its own DOIs, so doi.org's
 * content negotiation is the rung below it. That fallback is only worth
 * having if it survives the ways a rung can fail to answer.
 */
describe("the DOI ladder", () => {
    const DOI_URL = "https://doi.org/10.48550/arXiv.1706.03762";

    const resolveDoi = sourceOf("doi").resolve;

    const answered = () =>
        Promise.resolve(
            Response.json({
                type: "posted-content",
                DOI: "10.48550/arXiv.1706.03762",
                title: "Attention Is All You Need",
            }),
        );
    const notFound = () => Promise.resolve(new Response("", { status: 404 }));

    /**
     * Answer the first rung one way and the second another, recording what was
     * asked. Routing by position rather than by hostname is what stops these
     * from passing quietly if the endpoints are ever renamed or reordered —
     * every assertion below reads the record back.
     */
    const stub = (
        first: () => Promise<Response>,
        second: () => Promise<Response>,
    ): string[] => {
        const asked: string[] = [];
        vi.stubGlobal("fetch", (endpoint: string) => {
            asked.push(String(endpoint));
            return asked.length === 1 ? first() : second();
        });
        return asked;
    };

    test.each([
        ["refuses the connection", () => Promise.reject(new Error("ECONNREF"))],
        ["answers 404", notFound],
        [
            "answers with something that is not JSON",
            () => Promise.resolve(new Response("<!doctype html>")),
        ],
        [
            "answers with metadata that will not normalise",
            () => Promise.resolve(Response.json(null)),
        ],
    ])("doi.org answers when Crossref %s", async (_, crossref) => {
        const asked = stub(crossref, answered);
        const entry = await resolveDoi(DOI_URL);

        expect(entry.csl.title).toBe("Attention Is All You Need");
        // Both rungs were walked, in order, and it was the second that
        // answered — without this the test would pass on the first alone.
        expect(asked).toHaveLength(2);
        expect(asked[0]).toContain("crossref.org");
        expect(asked[1]).toBe(DOI_URL);
    });

    test("a DOI that no registrar answers for is a failed lookup", async () => {
        const asked = stub(notFound, notFound);
        await expect(resolveDoi(DOI_URL)).rejects.toThrow();
        expect(asked).toHaveLength(2);
    });

    /**
     * Every way of writing a link to one arXiv paper asks the registrars for
     * the same DOI: the paper's, not a version's, since DataCite registers
     * one per paper.
     */
    test("every form of arXiv link asks for its paper's DOI", async () => {
        const ids = [
            "1706.03762",
            "0704.0001",
            "2301.12345",
            "hep-th/9901001",
            "math.AG/0601001",
        ];
        const forms = (id: string) => [
            `https://arxiv.org/abs/${id}`,
            `https://arxiv.org/abs/${id}v3`,
            `https://arxiv.org/pdf/${id}`,
            `https://arxiv.org/pdf/${id}v12.pdf`,
            `https://www.arxiv.org/abs/${id}/`,
            `https://arxiv.org/abs/${id}?context=cs#section`,
        ];
        for (const id of ids) {
            for (const url of forms(id)) {
                expect(sourceFor(url).kind).toBe("doi");
                const asked = stub(notFound, answered);
                await resolveDoi(url);
                expect(asked[1]).toBe(`https://doi.org/10.48550/arXiv.${id}`);
            }
        }
    });
});

/**
 * Pages answered by the stubbed scraper, keyed by the URL it is asked for.
 * A URL missing here is a page that could not be fetched.
 */
const scraped = vi.hoisted(() => ({
    pages: {} as Record<
        string,
        { ogTitle?: string; ogImage?: { url: string }[] }
    >,
}));

vi.mock("open-graph-scraper", () => ({
    default: async ({ url }: { url: string }) => {
        const result = scraped.pages[url];
        if (result === undefined) throw new Error(`no page at ${url}`);
        return { result, html: "" };
    },
}));

/**
 * An OpenGraph image is only worth a place in the popover if it shows
 * something the title doesn't already say.
 */
describe("an external page's image", () => {
    const resolveExternal = sourceOf("external").resolve;

    /** Each case gets its own origin: homepage lookups last the build. */
    const serve = (origin: string, page: string, homepage?: string) => {
        scraped.pages = {
            [`${origin}/post`]: { ogTitle: "A Post", ogImage: [{ url: page }] },
            ...(homepage && {
                [origin]: { ogTitle: "Home", ogImage: [{ url: homepage }] },
            }),
        };
        return resolveExternal(`${origin}/post`);
    };

    test("is kept when it is the page's own", async () => {
        const entry = await serve(
            "https://own.example",
            "https://own.example/post/figure.png",
            "https://own.example/logo.png",
        );
        expect(entry.imageUrl).toBe("https://own.example/post/figure.png");
    });

    test("is kept when the homepage can't be fetched", async () => {
        const entry = await serve(
            "https://offline.example",
            "https://offline.example/figure.png",
        );
        expect(entry.imageUrl).toBe("https://offline.example/figure.png");
    });

    test("is dropped when it is a generated title card", async () => {
        const entry = await serve(
            "https://github.com",
            "https://opengraph.githubassets.com/abc123/owner/repo",
        );
        expect(entry.imageUrl).toBeUndefined();
    });

    test("is dropped when it is the site's logo", async () => {
        const entry = await serve(
            "https://logo.example",
            "https://logo.example/logo.png",
            "/logo.png",
        );
        expect(entry.imageUrl).toBeUndefined();
    });

    test("is made absolute against the page", async () => {
        const entry = await serve("https://relative.example", "figure.png");
        expect(entry.imageUrl).toBe("https://relative.example/figure.png");
    });
});

describe("isCitable", () => {
    test("every kind of link is a work to cite, except this site's own pages", () => {
        const entry = (kind: LinkKind): LinkEntry => ({
            resolution: "resolved",
            kind,
            csl: { type: "webpage", id: "x" },
        });
        const uncitable = linkKind.options.filter(
            (kind) => !isCitable(entry(kind)),
        );
        expect(uncitable).toEqual(["internal"]);
    });
});

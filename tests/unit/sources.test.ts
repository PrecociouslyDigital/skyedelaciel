import { describe, expect, test, vi } from "vitest";
import { isCitable, sourceFor, sourceOf } from "~/components/mdx/links/sources";
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

    "https://example.com/a": "external",
    "https://arxiv.org/abs/1706.03762": "external",
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
            (kind) => sourceOf(kind).resolve === undefined,
        );
        expect(unfetched).toEqual(["internal"]);
    });
});

/**
 * Crossref is the richer source but only knows its own DOIs, so doi.org's
 * content negotiation is the rung below it. That fallback is only worth
 * having if it survives the ways a rung can fail to answer.
 */
describe("the DOI ladder", () => {
    const DOI_URL = "https://doi.org/10.48550/arXiv.1706.03762";

    /** The DOI source's resolver, which the registry types as optional. */
    const resolveDoi = (url: string) => {
        const { resolve } = sourceOf("doi");
        if (!resolve) throw new Error("the DOI source lost its resolver");
        return resolve(url);
    };

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

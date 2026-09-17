import { describe, expect, test } from "vitest";
import {
    authorLine,
    formatAuthor,
    formatCitation,
    formatCslDate,
    formatInlineCitation,
} from "~/components/mdx/links/cite";
import { buildPreview } from "~/components/mdx/links/preview";
import { resolveInternalLinks } from "~/components/mdx/links/resolve";
import type { CslData, LinkEntry } from "~/components/mdx/links/types";
import { linkEntry, linkFrontmatter } from "~/components/mdx/links/types";

/** One `csl` per link kind, shaped the way each resolver leaves it. */
const csl = {
    external: {
        type: "webpage",
        id: "https://example.com/a",
        URL: "https://example.com/a",
        title: "An External Page",
        "container-title": "Fixture Publication",
        author: [{ given: "Ada", family: "Placeholder" }],
        issued: { "date-parts": [[2024, 6, 1]] },
    },
    internal: {
        type: "webpage",
        id: "/design",
        URL: "/design",
        title: "Design Specification",
        "container-title": "Skye De La Ciel",
    },
    wikipedia: {
        type: "webpage",
        id: "https://en.wikipedia.org/wiki/X",
        URL: "https://en.wikipedia.org/wiki/X",
        title: "X",
        "container-title": "Wikipedia",
    },
    doi: {
        type: "article-journal",
        id: "https://doi.org/10.0000/x",
        URL: "https://doi.org/10.0000/x",
        title: "A Paper",
        "container-title": "A Journal",
        author: [{ given: "Bo", family: "Marginalia" }],
        issued: { "date-parts": [[2026, 3]] },
    },
} satisfies Record<string, CslData>;

/** Every variant of the union, which is what the properties below quantify over. */
const entries: LinkEntry[] = [
    ...Object.entries(csl).map(([kind, data]) => ({
        resolution: "resolved" as const,
        kind: kind as LinkEntry["kind"],
        csl: data,
        summary: { type: "text" as const, content: "A summary." },
    })),
    {
        resolution: "resolved",
        kind: "wikipedia",
        csl: csl.wikipedia,
        summary: { type: "html", content: "<p>Marked up.</p>" },
        imageUrl: "/logo.svg",
    },
    ...Object.entries(csl).map(([kind, data]) => ({
        resolution: "unresolved" as const,
        kind: kind as LinkEntry["kind"],
        csl: data,
    })),
];

describe("LinkEntry", () => {
    test("survives the JSON round trip the frontmatter channel puts it through", () => {
        for (const entry of entries) {
            expect(linkEntry.parse(JSON.parse(JSON.stringify(entry)))).toEqual(
                entry,
            );
        }
    });

    test("a whole page's link metadata round-trips too", () => {
        const frontmatter = {
            links: entries.map((entry) => String(entry.csl.URL)),
            linkMeta: Object.fromEntries(
                entries.map((entry) => [String(entry.csl.URL), entry]),
            ),
        };
        expect(
            linkFrontmatter.parse(JSON.parse(JSON.stringify(frontmatter))),
        ).toEqual(frontmatter);
    });
});

describe("buildPreview", () => {
    test("an unresolved link never gets a popover", () => {
        for (const entry of entries.filter(
            (entry) => entry.resolution === "unresolved",
        )) {
            expect(buildPreview(entry)).toBeUndefined();
        }
    });

    test("a link with no title never gets a popover", () => {
        const { title: _, ...untitled } = csl.external;
        expect(
            buildPreview({
                resolution: "resolved",
                kind: "external",
                csl: untitled,
            }),
        ).toBeUndefined();
    });

    test("each kind contributes exactly what the spec says it does", () => {
        const preview = (kind: keyof typeof csl) =>
            buildPreview({
                resolution: "resolved",
                kind,
                csl: csl[kind],
                summary: { type: "text", content: "A summary." },
            });

        // design.mdx, Internal Pages: title, abstract and site name, nothing
        // else — so meta contributes only the site name here. The title and
        // abstract belong to resolveInternalLinks, below.
        expect(preview("internal")?.meta).toEqual([
            csl.internal["container-title"],
        ]);

        // Wikipedia contributes a summary and an image, and no author line.
        expect(preview("wikipedia")?.meta).toEqual([]);

        // DOIs and external pages carry the full apparatus.
        expect(preview("doi")?.meta).toEqual([
            "Bo Marginalia",
            "A Journal",
            "March 2026",
        ]);
        expect(preview("external")?.meta).toEqual([
            "Ada Placeholder",
            "Fixture Publication",
            "June 1, 2024",
        ]);
    });

    test("html summaries are made inline, text ones are left alone", () => {
        const wikipedia = entries.find(
            (entry) => entry.resolution === "resolved" && entry.imageUrl,
        )!;
        const preview = buildPreview(wikipedia)!;
        // Block markup becomes inline, because the popover lays its body out
        // on one flow; the words themselves are untouched.
        expect(preview.body).toEqual({
            type: "html",
            content: "<span>Marked up.</span>",
        });
        expect(preview.image).toBe("/logo.svg");

        const summary = {
            type: "text",
            content: "<p>Not markup.</p>",
        } as const;
        expect(
            buildPreview({
                resolution: "resolved",
                kind: "external",
                csl: csl.external,
                summary,
            })?.body,
        ).toEqual(summary);
    });
});

describe("formatCslDate", () => {
    test("renders at whatever granularity the date-parts array carries", () => {
        expect(formatCslDate({ "date-parts": [[2026]] })).toBe("2026");
        expect(formatCslDate({ "date-parts": [[2026, 3]] })).toBe("March 2026");
        expect(formatCslDate({ "date-parts": [[2026, 3, 9]] })).toBe(
            "March 9, 2026",
        );
    });

    test("a zero month is a month, not a missing one", () => {
        // The shape of the array decides the granularity, so this cannot read
        // as "year only" the way a truthiness test would make it.
        expect(formatCslDate({ "date-parts": [[2026, 1]] })).toBe(
            "January 2026",
        );
    });

    test("keeps unparseable input rather than inventing a date", () => {
        expect(formatCslDate({ raw: "sometime in the nineties" })).toBe(
            "sometime in the nineties",
        );
        expect(formatCslDate({ literal: "n.d." })).toBe("n.d.");
        expect(formatCslDate(undefined)).toBeUndefined();
    });
});

describe("author names", () => {
    test("a literal name wins over its parts", () => {
        expect(
            formatAuthor({ literal: "The Editors", family: "Ignored" }),
        ).toBe("The Editors");
    });

    test("a family name alone is enough; a given name alone is not", () => {
        expect(formatAuthor({ family: "Tufte" })).toBe("Tufte");
        expect(formatAuthor({ given: "Edward" })).toBeUndefined();
    });

    test("authorLine is empty rather than blank when nobody is named", () => {
        expect(authorLine(csl.wikipedia)).toBeUndefined();
        expect(authorLine({ ...csl.external, author: [] })).toBeUndefined();
        expect(authorLine(csl.external)).toBe("Ada Placeholder");
    });
});

describe("formatCitation", () => {
    test("renders MLA with the URL wrapped so print can reveal it", () => {
        const formatted = formatCitation(csl.external);
        expect(formatted).toContain("Placeholder, Ada");
        expect(formatted).toContain(
            '<span class="cite-url">https://example.com/a.</span>',
        );
    });
});

describe("formatInlineCitation", () => {
    test("names a work by its first author's surname and its year", () => {
        expect(formatInlineCitation(csl.external)).toBe("(Placeholder, 2024)");
        expect(formatInlineCitation(csl.doi)).toBe("(Marginalia, 2026)");
    });

    test("falls back to the title when a work has no author", () => {
        // Which is how the bibliography alphabetises it too, so the reader
        // looking it up has something to look for.
        expect(formatInlineCitation(csl.wikipedia)).toBe("(X)");
    });

    test("omits a year it does not have, rather than inventing one", () => {
        expect(
            formatInlineCitation({ ...csl.external, issued: undefined }),
        ).toBe("(Placeholder)");
    });

    test("an unresolved link has nothing to cite by", () => {
        // Only a URL and an access date, so there is no name to print — print
        // falls back to the address itself.
        expect(
            formatInlineCitation({
                type: "webpage",
                id: "https://example.com/a",
                URL: "https://example.com/a",
            }),
        ).toBeUndefined();
    });
});

describe("resolveInternalLinks", () => {
    const pages = new Map([
        [
            "design",
            { title: "Design Specification", abstract: "The abstract." },
        ],
    ]);

    test("resolves a site page to its title, abstract and site name", () => {
        const meta = resolveInternalLinks(["/design"], pages);
        expect(meta["/design"]).toEqual({
            resolution: "resolved",
            kind: "internal",
            csl: {
                type: "webpage",
                id: "/design",
                URL: "/design",
                title: "Design Specification",
                "container-title": "Skye De La Ciel",
            },
            summary: { type: "text", content: "The abstract." },
        });
    });

    test("ignores fragments and query strings when finding the page", () => {
        const page = resolveInternalLinks(["/design"], pages)["/design"];
        for (const url of ["/design#colors", "/design?x=1"]) {
            // Same page, same metadata — only the URL it is filed under moves.
            expect(resolveInternalLinks([url], pages)).toEqual({
                [url]: { ...page, csl: { ...page!.csl, id: url, URL: url } },
            });
        }
    });

    test("a link to a page we do not have gets no entry, and so no popover", () => {
        expect(resolveInternalLinks(["/nowhere", "#section"], pages)).toEqual(
            {},
        );
    });

    test("leaves external links entirely alone", () => {
        expect(resolveInternalLinks(["https://example.com/a"], pages)).toEqual(
            {},
        );
    });
});

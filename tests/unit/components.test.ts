import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, test } from "vitest";
import TableOfContents from "~/components/TableOfContents.astro";
import Bibliography from "~/components/mdx/links/Bibliography.astro";
import Link from "~/components/mdx/links/Link.astro";
import { setLinkContext } from "~/components/mdx/links/store";
import type {
    CslData,
    LinkMeta,
    ResolvedLink,
} from "~/components/mdx/links/types";

/**
 * The complement to the "illegal to misuse" work in the components themselves:
 * the types prove the props are well-formed, and these prove the markup that
 * comes out of them is what design.mdx describes.
 *
 * `experimental_AstroContainer` is still experimental in Astro 6 and may break
 * in a minor release; if it does, these move to Playwright and the rest of the
 * unit suite is unaffected.
 */
let container: AstroContainer;
beforeAll(async () => {
    container = await AstroContainer.create();
});

/**
 * Strip the attributes Astro adds for style scoping and dev-time source
 * mapping. They are noise here, and the source-location ones carry absolute
 * paths that would differ per machine.
 */
const clean = (html: string) =>
    html
        .replace(/\s*data-astro-cid-[\w-]+(="[^"]*")?/g, "")
        .replace(/\s*data-astro-source-(file|loc)="[^"]*"/g, "")
        .trim();

/**
 * What the rendered contents say, read back as data.
 *
 * Matching the markup as a string would make the tests fail on a changed
 * attribute order or a reflowed line, neither of which is a change to the
 * table of contents.
 */
const entriesIn = (html: string) =>
    [...html.matchAll(/href="#([^"]+)">([^<]*)</g)].map((match) => ({
        slug: match[1]!,
        text: match[2]!,
    }));

/** The slugs that own a collapsible section, in document order. */
const parentsIn = (html: string) =>
    [...html.matchAll(/<details[^>]*\bdata-slug="([^"]+)"/g)].map(
        (match) => match[1]!,
    );

describe("TableOfContents", () => {
    interface Heading {
        depth: number;
        slug: string;
        text: string;
    }

    const headings: Heading[] = [
        { depth: 1, slug: "one", text: "One" },
        { depth: 2, slug: "one-a", text: "One A" },
        { depth: 3, slug: "one-a-i", text: "One A i" },
        { depth: 2, slug: "one-b", text: "One B" },
        { depth: 1, slug: "two", text: "Two" },
    ];

    const render = (headings: Heading[]) =>
        container
            .renderToString(TableOfContents, { props: { headings } })
            .then(clean);

    /**
     * A heading is a parent when some heading after it is deeper, before the
     * next one at its own level or above. Stated here so the property below
     * quantifies over heading lists rather than over one example.
     */
    const expectedParents = (headings: Heading[]) =>
        headings
            .filter((heading, index) => {
                const after = headings.slice(index + 1);
                const sibling = after.findIndex(
                    (later) => later.depth <= heading.depth,
                );
                const descendants =
                    sibling === -1 ? after : after.slice(0, sibling);
                return descendants.length > 0;
            })
            .map((heading) => heading.slug);

    test("every heading appears once, in document order", async () => {
        expect(entriesIn(await render(headings))).toEqual(
            headings.map(({ slug, text }) => ({ slug, text })),
        );
    });

    test("a heading is collapsible exactly when it has children", async () => {
        for (const list of [
            headings,
            // No h2 in between: a skipped level must not orphan its children.
            [
                { depth: 1, slug: "top", text: "Top" },
                { depth: 3, slug: "deep", text: "Deep" },
            ],
            [{ depth: 1, slug: "lonely", text: "Lonely" }],
        ]) {
            const html = await render(list);
            expect(entriesIn(html).map((e) => e.slug)).toEqual(
                list.map((h) => h.slug),
            );
            expect(parentsIn(html)).toEqual(expectedParents(list));
        }
    });

    test("headings below the third level are left out", async () => {
        const html = await render([
            ...headings,
            { depth: 4, slug: "too-deep", text: "Too Deep" },
        ]);
        expect(entriesIn(html).map((entry) => entry.slug)).not.toContain(
            "too-deep",
        );
    });

    test("no headings renders nothing at all", async () => {
        expect(await render([])).toBe("");
    });
});

describe("Link", () => {
    const withMeta = async (meta: LinkMeta, href: string) => {
        setLinkContext({ meta, bibliography: false });
        return clean(
            await container.renderToString(Link, {
                props: { href },
                slots: { default: "the anchor text" },
            }),
        );
    };

    const entry: ResolvedLink = {
        resolution: "resolved",
        kind: "external",
        csl: {
            type: "webpage",
            id: "https://example.com/a",
            URL: "https://example.com/a",
            title: "An External Page",
            "container-title": "Fixture Publication",
        },
        summary: { type: "text", content: "A summary." },
    };
    const resolved: LinkMeta = { "https://example.com/a": entry };

    test("a link we know about gets a popover", async () => {
        const html = await withMeta(resolved, "https://example.com/a");
        expect(html).toContain('class="link-popover"');
        expect(html).toContain('role="tooltip"');
        expect(html).toContain("An External Page");
        expect(html).toContain("A summary.");
    });

    test("a link we know nothing about is a bare anchor", async () => {
        const html = await withMeta({}, "https://example.com/unknown");
        expect(html).not.toContain("link-popover");
        expect(html).toContain('class="content-link"');
        expect(html).toContain("the anchor text");
    });

    test("an unresolved entry gets no popover either", async () => {
        const html = await withMeta(
            {
                "https://example.com/a": {
                    resolution: "unresolved",
                    kind: "external",
                    csl: {
                        type: "webpage",
                        id: "https://example.com/a",
                        URL: "https://example.com/a",
                        title: "An External Page",
                    },
                },
            },
            "https://example.com/a",
        );
        expect(html).not.toContain("link-popover");
    });

    test("the popover image is opt-in", async () => {
        setLinkContext({
            meta: {
                "https://example.com/a": { ...entry, imageUrl: "/logo.svg" },
            },
            bibliography: false,
        });
        const without = clean(
            await container.renderToString(Link, {
                props: { href: "https://example.com/a" },
            }),
        );
        const withImage = clean(
            await container.renderToString(Link, {
                props: { href: "https://example.com/a", showImage: true },
            }),
        );

        expect(without).not.toContain("link-popover-image");
        expect(withImage).toContain("link-popover-image");
    });
});

describe("Bibliography", () => {
    const book: CslData = {
        type: "book",
        id: "tufte",
        title: "The Visual Display of Quantitative Information",
        author: [{ given: "Edward R.", family: "Tufte" }],
        publisher: "Graphics Press",
        issued: { "date-parts": [[2001]] },
    };

    const render = (linkMeta: LinkMeta, citations: CslData[] = []) =>
        container
            .renderToString(Bibliography, { props: { linkMeta, citations } })
            .then(clean);

    test("nothing to cite renders nothing", async () => {
        expect(await render({})).toBe("");
    });

    test("internal links are this site, not works to cite", async () => {
        expect(
            await render({
                "/design": {
                    resolution: "resolved",
                    kind: "internal",
                    csl: { type: "webpage", id: "/design", title: "Design" },
                },
            }),
        ).toBe("");
    });

    test("frontmatter citations appear alongside links", async () => {
        const html = await render({}, [book]);
        expect(html).toContain("Works Referenced");
        expect(html).toContain("Tufte, Edward R.");
    });

    test("entries are sorted, as a bibliography is", async () => {
        const html = await render({}, [
            book,
            { ...book, id: "abbott", author: [{ family: "Abbott" }] },
        ]);
        expect(html.indexOf("Abbott")).toBeLessThan(html.indexOf("Tufte"));
    });
});

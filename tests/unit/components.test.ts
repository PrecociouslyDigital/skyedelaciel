import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { select, selectAll } from "hast-util-select";
import { getContainerRenderer } from "@astrojs/svelte";
import { loadRenderers } from "astro:container";
import { beforeAll, describe, expect, test } from "vitest";
import Heading from "~/components/mdx/heading/Heading.astro";
import TableOfContents from "~/components/TableOfContents.astro";
import Bibliography from "~/components/mdx/links/Bibliography.astro";
import Link from "~/components/mdx/links/Link.astro";
import { parse, text } from "~/components/mdx/links/html";
import { setLinkContext } from "~/components/mdx/links/store";
import type {
    CslData,
    LinkMeta,
    ResolvedLink,
} from "~/components/mdx/links/types";

/**
 * The complement to the "illegal to misuse" work in the components themselves:
 * the types prove the props are well-formed, and these prove the markup that
 * comes out of them is what fixtures/design.mdx describes.
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
    [...html.matchAll(/href="#([^"]+)">[^<]*<\/a>\s*<details/g)].map(
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
     * The headings under a heading: those after it that are deeper, before
     * the next one at its own level or above. A heading is top-level when no
     * heading before it is shallower. Stated here so the properties below
     * quantify over heading lists rather than over one example.
     */
    const descendantsOf = (headings: Heading[], index: number) => {
        const after = headings.slice(index + 1);
        const sibling = after.findIndex(
            (later) => later.depth <= headings[index]!.depth,
        );
        return sibling === -1 ? after : after.slice(0, sibling);
    };
    const isTopLevel = (headings: Heading[], index: number) =>
        headings
            .slice(0, index)
            .every((before) => before.depth >= headings[index]!.depth);

    const expectedParents = (headings: Heading[]) =>
        headings
            .filter(
                (_, index) =>
                    isTopLevel(headings, index) &&
                    descendantsOf(headings, index).length > 0,
            )
            .map((heading) => heading.slug);

    const LISTS: Heading[][] = [
        headings,
        // No h2 in between: a skipped level must not orphan its children.
        [
            { depth: 1, slug: "top", text: "Top" },
            { depth: 3, slug: "deep", text: "Deep" },
        ],
        [{ depth: 1, slug: "lonely", text: "Lonely" }],
        // No h1 at all: the top level is whatever comes first.
        [
            { depth: 2, slug: "a", text: "A" },
            { depth: 3, slug: "a-i", text: "A i" },
            { depth: 3, slug: "a-ii", text: "A ii" },
            { depth: 2, slug: "b", text: "B" },
        ],
    ];

    test("every heading appears once, in document order", async () => {
        expect(entriesIn(await render(headings))).toEqual(
            headings.map(({ slug, text }) => ({ slug, text })),
        );
    });

    test("only the top level folds, and exactly where it has children", async () => {
        for (const list of LISTS) {
            const html = await render(list);
            expect(entriesIn(html).map((e) => e.slug)).toEqual(
                list.map((h) => h.slug),
            );
            expect(parentsIn(html)).toEqual(expectedParents(list));
        }
    });

    /**
     * A section's vine is drawn to the number of entries it unfolds, and each
     * of them arrives in turn as it grows: so every top-level entry says how
     * many entries are under it, and every entry under it says its place
     * among them, in the order a reader meets them.
     */
    test("a section counts its entries, and they arrive in order", async () => {
        for (const list of LISTS) {
            const tree = parse(await render(list));
            const sections = selectAll('li[data-depth="1"]', tree);
            const slugOf = (li: (typeof sections)[number]) =>
                String(select(":scope > a", li)!.properties.href).slice(1);

            for (const section of sections) {
                const index = list.findIndex((h) => h.slug === slugOf(section));
                const under = descendantsOf(list, index);
                const entries = selectAll(":scope li", section);

                expect(entries.map(slugOf)).toEqual(under.map((h) => h.slug));
                expect(section.properties.dataEntries).toBe(
                    String(under.length),
                );
                expect(
                    entries.map((li) => String(li.properties.style)),
                ).toEqual(under.map((_, i) => `--i: ${i}`));
            }
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

    /** The repository's own test images, which need no network to place. */
    const PORTRAIT = "/src/assets/link-images/fixture-portrait.svg";
    const LANDSCAPE = "/src/assets/link-images/fixture-landscape.svg";

    const popoverOf = async (link: ResolvedLink) => {
        const tree = parse(
            await withMeta(
                { "https://example.com/a": link },
                "https://example.com/a",
            ),
        );
        return select(".link-popover", tree)!;
    };

    test.each([
        ["a portrait", PORTRAIT, "column"],
        ["a landscape", LANDSCAPE, "banner"],
    ])("%s image is placed in a %s", async (_, imageUrl, placement) => {
        const popover = await popoverOf({ ...entry, imageUrl });
        expect(popover.properties.dataImage).toBe(placement);

        const image = select("img.link-popover-image", popover);
        expect(image?.properties.loading).toBe("lazy");
        expect(image?.properties.alt).toBe("");
    });

    test("no image, or one that can't be placed, leaves a single column", async () => {
        for (const link of [
            entry,
            { ...entry, imageUrl: "/src/assets/link-images/missing.png" },
            // An icon, which would have to be blown up to fill its box.
            { ...entry, imageUrl: "/src/assets/link-images/fixture-icon.svg" },
        ]) {
            const popover = await popoverOf(link);
            expect(popover.properties.dataImage).toBeUndefined();
            expect(select("img", popover)).toBeUndefined();
        }
    });

    test("fields become a ledger below the summary, one row each", async () => {
        const fields = [
            { label: "Born", value: "c. 303" },
            { label: "Known for", value: "<i>Calligraphy</i>" },
        ];
        const popover = await popoverOf({ ...entry, fields });

        const ledger = select("[role=table]", popover)!;
        const rows = selectAll("[role=row]", ledger).map((row) => [
            text(select("[role=rowheader]", row)!),
            text(select("[role=cell]", row)!),
        ]);
        expect(rows).toEqual([
            ["Born", "c. 303"],
            ["Known for", "Calligraphy"],
        ]);

        const column = select(".link-popover-text", popover)!;
        expect(selectAll(":scope > *", column).at(-1)).toBe(ledger);
    });

    test("no fields, no ledger", async () => {
        expect(select("[role=table]", await popoverOf(entry))).toBeUndefined();
    });

    /**
     * A link sits inside a paragraph, and a paragraph can only hold phrasing
     * content: the parser closes it at the first <div>, <table> or <ul>, and
     * the rest of the popover spills out after the sentence. So whatever a
     * source sends, everything in the popover must be phrasing content.
     */
    test("everything in a popover is phrasing content", async () => {
        const hostile =
            "<div><p>Block</p><ul><li>one</li></ul><table><tr><td>x</td></tr></table></div>";
        for (const link of [
            entry,
            { ...entry, imageUrl: PORTRAIT },
            { ...entry, imageUrl: LANDSCAPE },
            { ...entry, summary: { type: "html", content: hostile } },
            { ...entry, fields: [{ label: "Block", value: hostile }] },
        ] satisfies ResolvedLink[]) {
            const tags = selectAll("*", await popoverOf(link)).map(
                (element) => element.tagName,
            );
            expect(tags.filter((tag) => !PHRASING.has(tag))).toEqual([]);
        }
    });
});

/**
 * The HTML standard's phrasing content, less what can only be interactive or
 * embedded in ways a popover never is.
 */
const PHRASING = new Set([
    "a",
    "abbr",
    "b",
    "bdi",
    "bdo",
    "br",
    "cite",
    "code",
    "data",
    "dfn",
    "em",
    "i",
    "img",
    "kbd",
    "mark",
    "q",
    "s",
    "samp",
    "small",
    "span",
    "strong",
    "sub",
    "sup",
    "time",
    "u",
    "var",
    "wbr",
]);

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

describe("Heading", () => {
    /** Headings carry their address as a Svelte island, so they need its renderer. */
    let withIslands: AstroContainer;
    beforeAll(async () => {
        const renderers = await loadRenderers([getContainerRenderer()]);
        withIslands = await AstroContainer.create({ renderers });
    });

    const render = (props: Record<string, unknown>) =>
        withIslands
            .renderToString(Heading, {
                props: { as: "h2", ...props },
                slots: { default: "Default Style" },
            })
            .then((html) => parse(clean(html)));

    test("its words are not a link, and its address is its only one", async () => {
        const tree = await render({
            id: "default-style",
            "data-section": "1.1",
        });
        const words = select(".heading-words", tree)!;
        expect(text(words)).toBe("Default Style");
        expect(select("a", words)).toBeUndefined();
        expect(selectAll("a", tree).map((a) => a.properties.href)).toEqual([
            "#default-style",
        ]);
        expect(text(select("a", tree)!)).toBe("§ 1.1");
    });

    test("an unnumbered heading's address is the bare section sign", async () => {
        const tree = await render({ id: "everything-else", unnumbered: true });
        expect(text(select("a[href='#everything-else']", tree)!)).toBe("§");
        expect(select("[data-section]", tree)).toBeUndefined();
    });

    test("a heading neither numbered nor unnumbered fails", async () => {
        await expect(render({ id: "lost" })).rejects.toThrow(/section number/);
    });

    test("a heading with no id fails", async () => {
        await expect(render({ "data-section": "1" })).rejects.toThrow(/id/);
    });
});

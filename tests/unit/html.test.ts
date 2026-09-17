import { describe, expect, test } from "vitest";
import { visit } from "unist-util-visit";
import {
    documentTitle,
    inlineSummary,
    parse,
    summarySchema,
} from "~/components/mdx/links/html";

/**
 * Summaries are third-party markup on their way to `set:html`. These are the
 * inputs a hostile or careless source could supply.
 */
const HOSTILE = [
    "<script>alert(1)</script>",
    '<p onclick="steal()">text</p>',
    '<a href="javascript:alert(1)">click</a>',
    '<iframe src="https://evil.test"></iframe>',
    "<style>body{display:none}</style>",
    '<img src=x onerror="alert(1)">',
    '<object data="evil.swf"></object>',
    '<embed src="evil.swf">',
    '<form action="https://evil.test"><input name="password"></form>',
    '<p style="position:fixed;inset:0">overlay</p>',
    '<a href="https://ok.test" target="_blank">out</a>',
    "<svg><script>alert(1)</script></svg>",
    '<p class="content" id="title">collides with our own classes</p>',
    "<template><script>alert(1)</script></template>",
    "<math><mi>x</mi></math>",
];

/** The attribute names `summarySchema` permits on a tag, including the ones
 * it adds itself. */
const permitted = (tag: string): string[] => {
    const attributes = summarySchema.attributes ?? {};
    const required = summarySchema.required ?? {};
    return [
        ...(attributes[tag] ?? []),
        ...(attributes["*"] ?? []),
        ...Object.keys(required[tag] ?? {}),
    ].map((entry) => (typeof entry === "string" ? entry : entry[0]));
};

/** Every element in a fragment, with the attributes it carries. */
function elements(html: string): { tag: string; attributes: string[] }[] {
    const found: { tag: string; attributes: string[] }[] = [];
    visit(parse(html), "element", (node) => {
        found.push({
            tag: node.tagName,
            attributes: Object.keys(node.properties ?? {}),
        });
    });
    return found;
}

describe("inlineSummary", () => {
    /**
     * `summarySchema` is an allowlist, so the assertion is one too: whatever
     * survives has to be something the schema named. A denylist of known-bad
     * markup only catches what someone remembered to put in it.
     */
    test.each(HOSTILE)("only what the schema names survives %s", (input) => {
        for (const { tag, attributes } of elements(inlineSummary(input))) {
            expect(summarySchema.tagNames).toContain(tag);
            for (const attribute of attributes)
                expect(permitted(tag)).toContain(attribute);
        }
    });

    test("where a link opens is the reader's business, not the source's", () => {
        expect(
            inlineSummary('<a href="https://ok.test" target="_blank">out</a>'),
        ).not.toContain("target");
    });

    test("markup the schema never named is unwrapped to its text", () => {
        expect(inlineSummary("<math><mi>x</mi></math>")).toBe("x");
    });

    /**
     * The popover is laid out on one flow, so the body has to be legal inside
     * a paragraph — a block element there would end the paragraph early.
     */
    test("paragraphs become spans", () => {
        expect(inlineSummary("<p>One.</p><p>Two.</p>")).toBe(
            "<span>One.</span><span>Two.</span>",
        );
    });

    test("the words and the emphasis are left alone", () => {
        expect(inlineSummary("<p>A <b>fixture</b> <i>article</i>.</p>")).toBe(
            "<span>A <b>fixture</b> <i>article</i>.</span>",
        );
    });

    /**
     * Sanitising is a fixed point: feeding output back in changes nothing.
     * Without this, a second pass anywhere in the pipeline could alter what
     * the first one produced.
     */
    test.each(HOSTILE)("it is idempotent over %s", (input) => {
        const once = inlineSummary(input);
        expect(inlineSummary(once)).toBe(once);
    });

    test("a summary's links are followed on their own terms, not ours", () => {
        const out = inlineSummary('<a href="https://ok.test">out</a>');
        expect(out).toContain('rel="nofollow noopener noreferrer"');
        expect(out).toContain('href="https://ok.test"');
    });

    test("an unsafe href is dropped but its text is kept", () => {
        const out = inlineSummary('<a href="javascript:alert(1)">click</a>');
        expect(out).not.toMatch(/javascript:/);
        expect(out).toContain("click");
    });
});

describe("documentTitle", () => {
    test("it reads the title out of a document", () => {
        expect(
            documentTitle("<html><head><title>A Page</title></head></html>"),
        ).toBe("A Page");
    });

    /**
     * Two cases a string-based extractor could get wrong: an entity, and
     * markup that only looks nested because `<title>` is RAWTEXT.
     */
    test("it survives what a regex could not", () => {
        expect(documentTitle("<title>Tea &amp; Sympathy</title>")).toBe(
            "Tea & Sympathy",
        );
        // The `<em>` here is literal text, not a nested element.
        expect(documentTitle("<title>A <em>Good</em> Page</title>")).toBe(
            "A <em>Good</em> Page",
        );
        // Whitespace a publisher left in their template.
        expect(documentTitle("<title>\n  Padded\n</title>")).toBe("Padded");
    });

    test("a document with no usable title offers none", () => {
        expect(documentTitle("<html><body>No head.</body></html>")).toBe(
            undefined,
        );
        expect(documentTitle("<title>   </title>")).toBe(undefined);
    });
});

import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { jatsToText, toCsl } from "~/components/mdx/links/crossref";
import { cslData } from "~/components/mdx/links/types";

/**
 * Payloads recorded from real registrar responses, not hand-written — the
 * point is fields nobody anticipated. See
 * breadcrumbs/src/components/mdx/links/resolve.ts.md for the bug this guards
 * against.
 */

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const recorded = readdirSync(FIXTURES).filter((f) => f.endsWith(".json"));
const load = (file: string) =>
    JSON.parse(readFileSync(join(FIXTURES, file), "utf8")) as unknown;

describe("toCsl", () => {
    /** Without this, an empty fixtures directory would register no sweep at
     * all below and the suite would still pass. */
    test("there are recorded payloads to sweep", () => {
        expect(recorded.length).toBeGreaterThan(0);
    });

    /**
     * Runs across every recorded payload rather than one, since the failure
     * mode is an unanticipated field.
     */
    test.each(recorded)("%s normalises to valid CSL", (file) => {
        const url = "https://doi.org/10.0000/recorded";
        expect(cslData.safeParse(toCsl(load(file), url)).success).toBe(true);
    });

    test("it translates the registrar's vocabulary into CSL's", () => {
        const csl = toCsl(load("crossref-journal-article.json"), "u");
        expect(csl.type).toBe("article-journal");
        expect(toCsl(load("crossref-proceedings-article.json"), "u").type).toBe(
            "paper-conference",
        );
    });

    test("it supplies the id and URL that CSL requires and Crossref omits", () => {
        const url = "https://doi.org/10.1038/s41586-021-03819-2";
        const csl = toCsl(load("crossref-journal-article.json"), url);
        expect(csl.id).toBe("10.1038/s41586-021-03819-2");
        expect(csl.URL).toBe(url);
    });

    test("it keeps only the name fields CSL knows", () => {
        const payload = load("crossref-journal-article.json") as {
            author: unknown[];
        };
        const { author } = toCsl(payload, "u");
        // Counted off the payload, not written down: re-recording the fixture
        // should not be able to break this. Every author survives — it is the
        // extra fields hung off each one that must not.
        expect(author).toHaveLength(payload.author.length);
        // ORCID, affiliation and sequence are among the fields Crossref sends
        // that `cslName.strict()` rejects, so they must not survive.
        expect(author?.[0]).toEqual({ given: "John", family: "Jumper" });
    });

    test("it unwraps the scalars Crossref sends as single-element arrays", () => {
        const csl = toCsl(load("crossref-journal-article.json"), "u");
        expect(csl.title).toBe(
            "Highly accurate protein structure prediction with AlphaFold",
        );
        expect(csl["container-title"]).toBe("Nature");
    });

    test("it drops the extras a registrar invents, rather than failing", () => {
        // The DataCite payload carries `copyright`, which is not a CSL field.
        const csl = toCsl(load("datacite-preprint.json"), "u");
        expect("copyright" in csl).toBe(false);
        expect(csl.title).toBe("Attention Is All You Need");
    });

    test("an unknown work type becomes CSL's own catch-all", () => {
        expect(toCsl({ type: "some-new-thing", DOI: "10.1/x" }, "u").type).toBe(
            "document",
        );
    });

    /**
     * A registrar's strings index our lookup tables, so the names that every
     * JavaScript object already answers to are the ones to check: a plain
     * object hands back `Object.prototype.toString` instead of nothing, which
     * is neither a work type nor the absence of one.
     */
    const INHERITED = [
        "constructor",
        "toString",
        "valueOf",
        "hasOwnProperty",
        "__proto__",
    ];

    test.each(INHERITED)("a work type of %s is still catch-all", (type) => {
        expect(toCsl({ type, DOI: "10.1/x" }, "u").type).toBe("document");
    });

    test.each(INHERITED)("a field named %s is dropped, not fatal", (field) => {
        const csl = toCsl(
            { type: "journal-article", DOI: "10.1/x", [field]: "hello" },
            "u",
        );
        expect(csl.type).toBe("article-journal");
        expect(Object.hasOwn(csl, field)).toBe(false);
    });
});

describe("jatsToText", () => {
    test("it reduces JATS markup to its content", () => {
        expect(
            jatsToText(
                "<jats:title>Abstract</jats:title><jats:p>Proteins are <jats:italic>essential</jats:italic> to life.</jats:p>",
            ),
        ).toBe("Proteins are essential to life.");
    });

    test("it resolves the entities that survive an XML round trip", () => {
        expect(jatsToText("<jats:p>a &lt; b &amp; c &#8212; d</jats:p>")).toBe(
            "a < b & c — d",
        );
    });

    test("the abstract reaches citeproc without markup", () => {
        const { abstract } = toCsl(load("crossref-journal-article.json"), "u");
        expect(abstract).not.toMatch(/[<>]/);
        expect(abstract).toMatch(/^Proteins are essential to life/);
    });

    /**
     * The JATS heading is dropped by matching the word "Abstract", which is
     * also how several real abstracts open.
     */
    test("a word that merely starts with Abstract keeps its first letters", () => {
        expect(
            jatsToText("<jats:p>Abstraction is the key idea.</jats:p>"),
        ).toBe("Abstraction is the key idea.");
        expect(jatsToText("<jats:p>Abstracts are summaries.</jats:p>")).toBe(
            "Abstracts are summaries.",
        );
    });

    /**
     * `coerce` unwraps the single-element arrays registrars wrap scalars in,
     * so the flattening has to read the unwrapped copy — otherwise a wrapped
     * abstract reaches the popover as raw JATS.
     */
    test("an abstract sent as a one-element array is still flattened", () => {
        const { abstract } = toCsl(
            {
                type: "journal-article",
                DOI: "10.1/x",
                abstract: [
                    "<jats:title>Abstract</jats:title><jats:p>Hello &amp; goodbye.</jats:p>",
                ],
            },
            "u",
        );
        expect(abstract).toBe("Hello & goodbye.");
    });
});

import { z } from "zod";

export type CslDate = z.infer<typeof cslDate>;

export const cslDate = z
    .object({
        "date-parts": z
            .array(
                z
                    .array(z.union([z.string(), z.number()]))
                    .min(1)
                    .max(3),
            )
            .min(1)
            .max(2)
            .optional(),
        season: z.union([z.string(), z.number()]).optional(),
        circa: z.union([z.string(), z.number(), z.boolean()]).optional(),
        literal: z.string().optional(),
        raw: z.string().optional(),
    })
    .strict()
    .describe(
        "The CSL input model supports two different date representations: an EDTF string (preferred), and a more structured alternative.",
    );

export type CslCitation = z.infer<typeof cslCitation>;
export const cslCitation = z
    .object({
        schema: z.literal(
            "https://resource.citationstyles.org/schema/latest/input/json/csl-citation.json",
        ),
        citationID: z.union([z.string(), z.number()]),
        citationItems: z
            .array(
                z
                    .object({
                        id: z.union([z.string(), z.number()]),
                        itemData: z.any().optional(),
                        prefix: z.string().optional(),
                        suffix: z.string().optional(),
                        locator: z.string().optional(),
                        label: z
                            .enum([
                                "act",
                                "appendix",
                                "article-locator",
                                "book",
                                "canon",
                                "chapter",
                                "column",
                                "elocation",
                                "equation",
                                "figure",
                                "folio",
                                "issue",
                                "line",
                                "note",
                                "opus",
                                "page",
                                "paragraph",
                                "part",
                                "rule",
                                "scene",
                                "section",
                                "sub-verbo",
                                "supplement",
                                "table",
                                "timestamp",
                                "title-locator",
                                "verse",
                                "version",
                                "volume",
                            ])
                            .optional(),
                        "suppress-author": z
                            .union([z.string(), z.number(), z.boolean()])
                            .optional(),
                        "author-only": z
                            .union([z.string(), z.number(), z.boolean()])
                            .optional(),
                        uris: z.array(z.string()).optional(),
                    })
                    .strict(),
            )
            .optional(),
        properties: z
            .object({ noteIndex: z.number().optional() })
            .strict()
            .optional(),
    })
    .strict()
    .describe("JSON schema for CSL citation objects");

export type CslName = z.infer<typeof cslName>;

/** A CSL name object, as used by every contributor field below. */
export const cslName = z
    .object({
        family: z.string().optional(),
        given: z.string().optional(),
        "dropping-particle": z.string().optional(),
        "non-dropping-particle": z.string().optional(),
        suffix: z.string().optional(),
        "comma-suffix": z
            .union([z.string(), z.number(), z.boolean()])
            .optional(),
        "static-ordering": z
            .union([z.string(), z.number(), z.boolean()])
            .optional(),
        literal: z.string().optional(),
        "parse-names": z
            .union([z.string(), z.number(), z.boolean()])
            .optional(),
    })
    .strict();

export type CslData = z.infer<typeof cslData>;

export const cslData = z
    .object({
        type: z.enum([
            "article",
            "article-journal",
            "article-magazine",
            "article-newspaper",
            "bill",
            "book",
            "broadcast",
            "chapter",
            "classic",
            "collection",
            "dataset",
            "document",
            "entry",
            "entry-dictionary",
            "entry-encyclopedia",
            "event",
            "figure",
            "graphic",
            "hearing",
            "interview",
            "legal_case",
            "legislation",
            "manuscript",
            "map",
            "motion_picture",
            "musical_score",
            "pamphlet",
            "paper-conference",
            "patent",
            "performance",
            "periodical",
            "personal_communication",
            "post",
            "post-weblog",
            "regulation",
            "report",
            "review",
            "review-book",
            "software",
            "song",
            "speech",
            "standard",
            "thesis",
            "treaty",
            "webpage",
        ]),
        id: z.union([z.string(), z.number()]),
        "citation-key": z.string().optional(),
        categories: z.array(z.string()).optional(),
        language: z.string().optional(),
        journalAbbreviation: z.string().optional(),
        shortTitle: z.string().optional(),
        author: cslName.array().optional(),
        chair: cslName.array().optional(),
        "collection-editor": cslName.array().optional(),
        compiler: cslName.array().optional(),
        composer: cslName.array().optional(),
        "container-author": cslName.array().optional(),
        contributor: cslName.array().optional(),
        curator: cslName.array().optional(),
        director: cslName.array().optional(),
        editor: cslName.array().optional(),
        "editorial-director": cslName.array().optional(),
        "executive-producer": cslName.array().optional(),
        guest: cslName.array().optional(),
        host: cslName.array().optional(),
        interviewer: cslName.array().optional(),
        illustrator: cslName.array().optional(),
        narrator: cslName.array().optional(),
        organizer: cslName.array().optional(),
        "original-author": cslName.array().optional(),
        performer: cslName.array().optional(),
        producer: cslName.array().optional(),
        recipient: cslName.array().optional(),
        "reviewed-author": cslName.array().optional(),
        "script-writer": cslName.array().optional(),
        "series-creator": cslName.array().optional(),
        translator: cslName.array().optional(),
        accessed: cslDate.optional(),
        "available-date": cslDate.optional(),
        "event-date": cslDate.optional(),
        issued: cslDate.optional(),
        "original-date": cslDate.optional(),
        submitted: cslDate.optional(),
        abstract: z.string().optional(),
        annote: z.string().optional(),
        archive: z.string().optional(),
        archive_collection: z.string().optional(),
        archive_location: z.string().optional(),
        "archive-place": z.string().optional(),
        authority: z.string().optional(),
        "call-number": z.string().optional(),
        "chapter-number": z.union([z.string(), z.number()]).optional(),
        "citation-number": z.union([z.string(), z.number()]).optional(),
        "citation-label": z.string().optional(),
        "collection-number": z.union([z.string(), z.number()]).optional(),
        "collection-title": z.string().optional(),
        "container-title": z.string().optional(),
        "container-title-short": z.string().optional(),
        dimensions: z.string().optional(),
        division: z.string().optional(),
        DOI: z.string().optional(),
        edition: z.union([z.string(), z.number()]).optional(),
        event: z
            .string()
            .describe(
                "[Deprecated - use 'event-title' instead. Will be removed in 1.1]",
            )
            .optional(),
        "event-title": z.string().optional(),
        "event-place": z.string().optional(),
        "first-reference-note-number": z
            .union([z.string(), z.number()])
            .optional(),
        genre: z.string().optional(),
        ISBN: z.string().optional(),
        ISSN: z.string().optional(),
        issue: z.union([z.string(), z.number()]).optional(),
        jurisdiction: z.string().optional(),
        keyword: z.string().optional(),
        locator: z.union([z.string(), z.number()]).optional(),
        medium: z.string().optional(),
        note: z.string().optional(),
        number: z.union([z.string(), z.number()]).optional(),
        "number-of-pages": z.union([z.string(), z.number()]).optional(),
        "number-of-volumes": z.union([z.string(), z.number()]).optional(),
        "original-publisher": z.string().optional(),
        "original-publisher-place": z.string().optional(),
        "original-title": z.string().optional(),
        page: z.union([z.string(), z.number()]).optional(),
        "page-first": z.union([z.string(), z.number()]).optional(),
        part: z.union([z.string(), z.number()]).optional(),
        "part-title": z.string().optional(),
        PMCID: z.string().optional(),
        PMID: z.string().optional(),
        printing: z.union([z.string(), z.number()]).optional(),
        publisher: z.string().optional(),
        "publisher-place": z.string().optional(),
        references: z.string().optional(),
        "reviewed-genre": z.string().optional(),
        "reviewed-title": z.string().optional(),
        scale: z.string().optional(),
        section: z.string().optional(),
        source: z.string().optional(),
        status: z.string().optional(),
        supplement: z.union([z.string(), z.number()]).optional(),
        title: z.string().optional(),
        "title-short": z.string().optional(),
        URL: z.string().optional(),
        version: z.string().optional(),
        volume: z.union([z.string(), z.number()]).optional(),
        "volume-title": z.string().optional(),
        "volume-title-short": z.string().optional(),
        "year-suffix": z.string().optional(),
        custom: z
            .record(z.string(), z.any())
            .describe(
                "Used to store additional information that does not have a designated CSL JSON field. The custom field is preferred over the note field for storing custom data, particularly for storing key-value pairs, as the note field is used for user annotations in annotated bibliography styles.",
            )
            .optional(),
    })
    .strict()
    .describe("JSON schema for CSL input data");

/** What sort of link this is — a property of the URL alone. */
export type LinkKind = z.infer<typeof linkKind>;
export const linkKind = z.enum(["internal", "doi", "wikipedia", "external"]);

/** Popover body text, in whichever form the source gave it to us. */
export type Summary = z.infer<typeof summary>;
export const summary = z.object({
    type: z.enum(["html", "text"]),
    content: z.string(),
});

/** A link we managed to look up. */
export type ResolvedLink = z.infer<typeof resolvedLink>;
export const resolvedLink = z.object({
    resolution: z.literal("resolved"),
    kind: linkKind,
    csl: cslData,
    summary: summary.optional(),
    imageUrl: z.string().optional(),
});

/**
 * A link we failed to look up. It still carries a `csl` — enough for a
 * bare-URL bibliography entry — but nothing a popover could be built from.
 */
export type UnresolvedLink = z.infer<typeof unresolvedLink>;
export const unresolvedLink = z.object({
    resolution: z.literal("unresolved"),
    kind: linkKind,
    csl: cslData,
});

/**
 * Everything known about one link. `kind` and `resolution` are orthogonal:
 * any kind of link can fail to resolve.
 */
export type LinkEntry = z.infer<typeof linkEntry>;
export const linkEntry = z.discriminatedUnion("resolution", [
    resolvedLink,
    unresolvedLink,
]);

/** Every link in a document, keyed by URL. */
export type LinkMeta = z.infer<typeof linkMeta>;
export const linkMeta = z.record(z.string(), linkEntry);

/**
 * What the extractLinks remark plugin contributes to a page's frontmatter.
 * That channel is a JSON round-trip, so the far side re-parses rather than
 * trusting what comes out of it.
 */
export type LinkFrontmatter = z.infer<typeof linkFrontmatter>;
export const linkFrontmatter = z.object({
    links: z.array(z.string()).default([]),
    linkMeta: linkMeta.default({}),
});

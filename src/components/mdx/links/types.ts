export type { Data as CslData } from "csl-json";
import { z } from "zod";

export type LinkKind = "internal" | "doi" | "wikipedia" | "external";

export interface LinkEntry {
    csl: import("csl-json").Data;
    kind: LinkKind;
    summary?: string;
    imageUrl?: string;
}

export const cslCitation = z
  .object({
    schema: z.literal(
      "https://resource.citationstyles.org/schema/latest/input/json/csl-citation.json"
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
          .strict()
      )
      .optional(),
    properties: z
      .object({ noteIndex: z.number().optional() })
      .strict()
      .optional(),
  })
  .strict()
  .describe("JSON schema for CSL citation objects");

export const cslData = z
  .array(
    z
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
        author: z
          .array(
            z
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
              .strict()
          )
          .optional(),
        chair: z
          .array(
            z
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
              .strict()
          )
          .optional(),
        "collection-editor": z
          .array(
            z
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
              .strict()
          )
          .optional(),
        compiler: z
          .array(
            z
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
              .strict()
          )
          .optional(),
        composer: z
          .array(
            z
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
              .strict()
          )
          .optional(),
        "container-author": z
          .array(
            z
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
              .strict()
          )
          .optional(),
        contributor: z
          .array(
            z
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
              .strict()
          )
          .optional(),
        curator: z
          .array(
            z
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
              .strict()
          )
          .optional(),
        director: z
          .array(
            z
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
              .strict()
          )
          .optional(),
        editor: z
          .array(
            z
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
              .strict()
          )
          .optional(),
        "editorial-director": z
          .array(
            z
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
              .strict()
          )
          .optional(),
        "executive-producer": z
          .array(
            z
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
              .strict()
          )
          .optional(),
        guest: z
          .array(
            z
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
              .strict()
          )
          .optional(),
        host: z
          .array(
            z
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
              .strict()
          )
          .optional(),
        interviewer: z
          .array(
            z
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
              .strict()
          )
          .optional(),
        illustrator: z
          .array(
            z
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
              .strict()
          )
          .optional(),
        narrator: z
          .array(
            z
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
              .strict()
          )
          .optional(),
        organizer: z
          .array(
            z
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
              .strict()
          )
          .optional(),
        "original-author": z
          .array(
            z
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
              .strict()
          )
          .optional(),
        performer: z
          .array(
            z
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
              .strict()
          )
          .optional(),
        producer: z
          .array(
            z
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
              .strict()
          )
          .optional(),
        recipient: z
          .array(
            z
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
              .strict()
          )
          .optional(),
        "reviewed-author": z
          .array(
            z
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
              .strict()
          )
          .optional(),
        "script-writer": z
          .array(
            z
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
              .strict()
          )
          .optional(),
        "series-creator": z
          .array(
            z
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
              .strict()
          )
          .optional(),
        translator: z
          .array(
            z
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
              .strict()
          )
          .optional(),
        accessed: z
          .object({
            "date-parts": z
              .array(
                z
                  .array(z.union([z.string(), z.number()]))
                  .min(1)
                  .max(3)
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
            "The CSL input model supports two different date representations: an EDTF string (preferred), and a more structured alternative."
          )
          .optional(),
        "available-date": z
          .object({
            "date-parts": z
              .array(
                z
                  .array(z.union([z.string(), z.number()]))
                  .min(1)
                  .max(3)
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
            "The CSL input model supports two different date representations: an EDTF string (preferred), and a more structured alternative."
          )
          .optional(),
        "event-date": z
          .object({
            "date-parts": z
              .array(
                z
                  .array(z.union([z.string(), z.number()]))
                  .min(1)
                  .max(3)
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
            "The CSL input model supports two different date representations: an EDTF string (preferred), and a more structured alternative."
          )
          .optional(),
        issued: z
          .object({
            "date-parts": z
              .array(
                z
                  .array(z.union([z.string(), z.number()]))
                  .min(1)
                  .max(3)
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
            "The CSL input model supports two different date representations: an EDTF string (preferred), and a more structured alternative."
          )
          .optional(),
        "original-date": z
          .object({
            "date-parts": z
              .array(
                z
                  .array(z.union([z.string(), z.number()]))
                  .min(1)
                  .max(3)
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
            "The CSL input model supports two different date representations: an EDTF string (preferred), and a more structured alternative."
          )
          .optional(),
        submitted: z
          .object({
            "date-parts": z
              .array(
                z
                  .array(z.union([z.string(), z.number()]))
                  .min(1)
                  .max(3)
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
            "The CSL input model supports two different date representations: an EDTF string (preferred), and a more structured alternative."
          )
          .optional(),
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
            "[Deprecated - use 'event-title' instead. Will be removed in 1.1]"
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
            "Used to store additional information that does not have a designated CSL JSON field. The custom field is preferred over the note field for storing custom data, particularly for storing key-value pairs, as the note field is used for user annotations in annotated bibliography styles."
          )
          .optional(),
      })
      .strict()
  )
  .describe("JSON schema for CSL input data");

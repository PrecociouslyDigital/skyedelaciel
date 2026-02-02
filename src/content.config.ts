import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/** Zod schema for CSL-JSON items, validating required fields and item type. */
const cslData = z
    .object({
        id: z.string(),
        type: z.enum([
            "article",
            "article-journal",
            "article-magazine",
            "article-newspaper",
            "bill",
            "book",
            "broadcast",
            "chapter",
            "dataset",
            "entry",
            "entry-dictionary",
            "entry-encyclopedia",
            "figure",
            "graphic",
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
            "personal_communication",
            "post",
            "post-weblog",
            "report",
            "review",
            "review-book",
            "song",
            "speech",
            "thesis",
            "treaty",
            "webpage",
        ]),
    })
    .passthrough();

const pages = defineCollection({
    loader: glob({ pattern: "**/*.mdx", base: "./src/content" }),
    schema: z.object({
        title: z.string(),
        abstract: z.string(),
        author: z.string().optional(),
        bibliography: z.boolean().default(true),
        citation: z.array(cslData).optional(),
    }),
});

export const collections = { pages };

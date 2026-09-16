import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { cslData } from "~/components/mdx/links/types";
import { z } from "zod";

const pageSchema = z.object({
    title: z.string(),
    abstract: z.string(),
    author: z.string().optional(),
    bibliography: z.boolean().default(false),
    citation: z.array(cslData).default([]),
});

/**
 * Real pages. The negated glob is what keeps fixtures out: a fixture cannot
 * end up here by being named or moved carelessly, only by leaving the
 * fixtures directory entirely.
 */
const pages = defineCollection({
    loader: glob({
        pattern: ["**/*.mdx", "!fixtures/**"],
        base: "./src/content",
    }),
    schema: pageSchema,
});

/**
 * Pages that exist only to be tested against. They share `pages`' schema but
 * live in their own collection, so the production route has to opt into them
 * explicitly — see src/pages/[...slug].astro and
 * breadcrumbs/src/content.config.ts.md.
 */
const fixtures = defineCollection({
    loader: glob({ pattern: "fixtures/**/*.mdx", base: "./src/content" }),
    schema: pageSchema,
});

export const collections = { pages, fixtures };

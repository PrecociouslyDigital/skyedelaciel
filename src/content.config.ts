import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const pages = defineCollection({
    loader: glob({ pattern: "**/*.mdx", base: "./src/content" }),
    schema: z.object({
        title: z.string(),
        abstract: z.string(),
        author: z.string().optional(),
        bibliography: z.boolean().default(true),
        citation: z.array(z.record(z.unknown())).optional(),
    }),
});

export const collections = { pages };

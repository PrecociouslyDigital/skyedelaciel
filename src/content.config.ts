import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { cslData } from "~/components/mdx/links/types";
import { z } from "zod";

const pages = defineCollection({
    loader: glob({ pattern: "**/*.mdx", base: "./src/content" }),
    schema: z.object({
        title: z.string(),
        abstract: z.string(),
        author: z.string().optional(),
        bibliography: z.boolean().default(false),
        citation: z.array(cslData).default([]),
    }),
});

export const collections = { pages };

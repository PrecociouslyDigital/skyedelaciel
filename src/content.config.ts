import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { cslData } from "~/components/mdx/links/types";
import { partitioned } from "~/content/partitioned";
import { isPublished } from "~/content/schedule";
import { z } from "zod";

const pageSchema = z.object({
    title: z.string(),
    abstract: z.string(),
    author: z.string().optional(),
    /* Dates the page carries itself, as distinct from the build's. A page
       cannot ship without saying when it was published; `updated` is absent
       until there is a revision worth naming. Both are read as dates rather
       than strings so that an impossible one fails the build. */
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    bibliography: z.boolean().default(false),
    citation: z.array(cslData).default([]),
});

/** A section page introduces its directory's articles, and is not dated. */
const sectionSchema = z.object({
    title: z.string(),
    abstract: z.string(),
});

/**
 * The part of src/content a family of collections reads. Real pages and
 * fixtures each get a family, so a fixture cannot end up among real pages by
 * being named or moved carelessly, only by leaving the fixtures directory.
 */
interface Scope {
    within: string;
    except: string[];
}
const SITE: Scope = { within: "", except: ["fixtures/**"] };
const FIXTURES: Scope = { within: "fixtures/", except: [] };

/** The files in `scope` called `name`, less any that match `also`. */
const files = ({ within, except }: Scope, name: string, ...also: string[]) =>
    glob({
        pattern: [
            `${within}**/${name}`,
            ...[...except, ...also].map((pattern) => `!${pattern}`),
        ],
        base: "./src/content",
    });

/** A directory's `index.mdx` is its section page, and never an article. */
const articles = (scope: Scope) => files(scope, "*.mdx", "**/index.mdx");

const sections = (scope: Scope) =>
    defineCollection({
        loader: files(scope, "index.mdx"),
        schema: sectionSchema,
    });

/** Whether an article's parsed data says it is out. */
const isOut = (data: Record<string, unknown>) =>
    isPublished(pageSchema.shape.published.parse(data.published));

/** Articles that are out, and the ones still to come, from the same files. */
const published = (scope: Scope) =>
    defineCollection({
        loader: partitioned(articles(scope), isOut),
        schema: pageSchema,
    });
const scheduled = (scope: Scope) =>
    defineCollection({
        loader: partitioned(articles(scope), (data) => !isOut(data)),
        schema: pageSchema,
    });

/**
 * Which of these are routed, and where, is decided in one place:
 * src/content/corpus.ts. See breadcrumbs/src/content.config.ts.md.
 */
export const collections = {
    pages: published(SITE),
    scheduled: scheduled(SITE),
    sections: sections(SITE),
    fixtures: published(FIXTURES),
    scheduledFixtures: scheduled(FIXTURES),
    fixtureSections: sections(FIXTURES),
};

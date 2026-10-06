import { getCollection, type CollectionEntry } from "astro:content";

/**
 * Which pages are built, and which pages a link can name. Every route reads
 * its pages from here rather than from a collection, so these rules hold
 * everywhere at once.
 */

export type Article = CollectionEntry<
    "pages" | "fixtures" | "scheduled" | "scheduledFixtures"
>;
export type Section = CollectionEntry<"sections" | "fixtureSections">;

/**
 * Fixtures are a test surface rather than content, so a plain `astro build`
 * routes none of them; `npm run build:fixtures` sets INCLUDE_FIXTURES to add
 * them. Read at call time, because a route's getStaticPaths is hoisted out of
 * its module and calls in from there.
 */
const fixtures = async <T>(load: () => Promise<T[]>): Promise<T[]> =>
    process.env.INCLUDE_FIXTURES ? load() : [];

/** Articles that are out, each built at `/<id>/`. */
export const publishedArticles = async (): Promise<Article[]> => [
    ...(await getCollection("pages")),
    ...(await fixtures(() => getCollection("fixtures"))),
];

/** Articles still to come, each built at `/${SCHEDULED_PREFIX}/<id>/`. */
export const scheduledArticles = async (): Promise<Article[]> => [
    ...(await getCollection("scheduled")),
    ...(await fixtures(() => getCollection("scheduledFixtures"))),
];

/** Section pages, each built at `/<id>/`. */
export const sectionPages = async (): Promise<Section[]> => [
    ...(await getCollection("sections")),
    ...(await fixtures(() => getCollection("fixtureSections"))),
];

/**
 * Every page a link in an article might name, by id, whether or not it is
 * built: a link to a fixture still gets its popover in a plain build, and a
 * link to a scheduled article is named so that it can be refused by date
 * rather than by a missing file.
 */
export function linkTargets(): Promise<Map<string, Article | Section>> {
    // Read once per build, since nothing changes mid-build and every page
    // asks. The dev server reads afresh, so that an edited title shows.
    if (import.meta.env.DEV) return readLinkTargets();
    return (built ??= readLinkTargets());
}

let built: Promise<Map<string, Article | Section>> | undefined;

async function readLinkTargets() {
    const everything: (Article | Section)[][] = await Promise.all([
        getCollection("pages"),
        getCollection("scheduled"),
        getCollection("sections"),
        getCollection("fixtures"),
        getCollection("scheduledFixtures"),
        getCollection("fixtureSections"),
    ]);
    return new Map(everything.flat().map((entry) => [entry.id, entry]));
}

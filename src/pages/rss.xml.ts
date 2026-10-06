import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { SITE_DESCRIPTION, SITE_NAME } from "~/components/mdx/links/sources";
import { publishedArticles, sectionPages } from "~/content/corpus";
import { sectioned } from "~/content/sections";

/** Every piece in a section, latest first. */
export async function GET({ site }: APIContext) {
    const pieces = sectioned(await publishedArticles(), await sectionPages());
    return rss({
        title: SITE_NAME,
        description: SITE_DESCRIPTION,
        site: site!,
        items: pieces.map(({ id, data }) => ({
            title: data.title,
            description: data.abstract,
            pubDate: data.published,
            link: `/${id}/`,
        })),
    });
}

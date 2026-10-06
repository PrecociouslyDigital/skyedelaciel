import { render } from "astro:content";
import { setLinkContext } from "~/components/mdx/links/store";
import { resolveInternalLinks } from "~/components/mdx/links/resolve";
import { linkFrontmatter } from "~/components/mdx/links/types";
import { linkTargets, type Article, type Section } from "./corpus";

/**
 * Render a page of prose with its links resolved, and hand them to <Link>
 * before its content renders. Internal links need no network: they are
 * resolved from the collections themselves.
 */
export async function renderWithLinks(
    entry: Article | Section,
    { bibliography }: { bibliography: boolean },
) {
    const { Content, headings, remarkPluginFrontmatter } = await render(entry);
    const { links, linkMeta: remoteLinks } = linkFrontmatter.parse(
        remarkPluginFrontmatter,
    );

    const targets = await linkTargets();
    const linkMeta = {
        ...remoteLinks,
        ...resolveInternalLinks(
            links,
            new Map([...targets].map(([id, page]) => [id, page.data])),
        ),
    };

    setLinkContext({ meta: linkMeta, bibliography });
    return { Content, headings, links, linkMeta, targets };
}

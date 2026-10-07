/**
 * Where a page is being served from. The navbar is the same on both, but on
 * Tumblr this site's own paths have to name the site, and the Tumblr entry is
 * the one the reader is on.
 */
export type Host = "site" | "tumblr";

export const TUMBLR =
    "https://skyedelaciel.tumblr.com/tagged/for%20public%20consumption";

/**
 * A navbar entry: a page of this site, named by its path, or an address
 * elsewhere. An address that is one of this site's hosts says so, so that
 * the navbar can mark it current while the reader is there.
 */
export type NavLink =
    | { label: string; path: `/${string}` }
    | { label: string; url: string; host?: Host };

export const navLinks: NavLink[] = [
    { label: "Fiction", path: "/fiction" },
    { label: "Nonfiction", path: "/nonfiction" },
    { label: "Tumblr", url: TUMBLR, host: "tumblr" },
];

/** Where an entry points, from a page on `host`. */
export function hrefFor(link: NavLink, host: Host, site: URL): string {
    if (!("path" in link)) return link.url;
    return host === "site" ? link.path : new URL(link.path, site).href;
}

/** Whether an entry is where the reader already is. */
export function isCurrent(link: NavLink, host: Host, pathname: string) {
    if (!("path" in link)) return link.host === host;
    return (
        host === "site" &&
        (pathname === link.path || pathname.startsWith(`${link.path}/`))
    );
}

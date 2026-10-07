import { describe, expect, test } from "vitest";
import { hrefFor, isCurrent, navLinks, type Host } from "~/components/nav";
import { chance, type Chance } from "~/layouts/prelude/chance.mjs";
import { SITE_URL } from "~/site";
import { parse, render } from "~/tumblr/render";
import {
    readStamp,
    stamp,
    THEME_HASH_PLACEHOLDER,
    themeHash,
} from "~/tumblr/stamp.mjs";
import { BLOCKS } from "~/tumblr/tags";

/** A well-formed template: blocks nested properly, text between them. */
function template(r: Chance, depth = 0): string {
    const parts: string[] = [];
    while (r.odds(0.7) && parts.length < 4) {
        const name = r.pick(BLOCKS);
        parts.push(
            depth < 3 && r.odds(0.6)
                ? `{block:${name}}${template(r, depth + 1)}{/block:${name}}`
                : `<p>{${name}}</p>`,
        );
    }
    return parts.join("");
}

const templates = Array.from({ length: 200 }, (_, n) => template(chance(n)));

describe("parse", () => {
    test("accepts every properly nested template", () => {
        for (const source of templates)
            expect(() => parse(source)).not.toThrow();
    });

    test("rejects any template with one closing tag removed", () => {
        for (const source of templates) {
            const close = source.lastIndexOf("{/block:");
            if (close === -1) continue;
            const broken =
                source.slice(0, close) +
                source.slice(source.indexOf("}", close) + 1);
            expect(() => parse(broken), broken).toThrow();
        }
    });

    test("rejects blocks closed out of turn", () => {
        expect(() =>
            parse("{block:Posts}{block:Text}{/block:Posts}{/block:Text}"),
        ).toThrow(/closes \{block:Text\}/);
    });
});

describe("render", () => {
    test("a block repeats for a list, stays for true, and goes for false", () => {
        const page =
            "{block:Posts}[{block:Title}{Title}{/block:Title}]{/block:Posts}";
        expect(
            render(page, {
                Posts: [{ Title: "a" }, { Title: false }, { Title: "c" }],
            }),
        ).toBe("[a][][c]");
    });

    test("a name resolves in the innermost scope that has it", () => {
        const page = "{Title}{block:Posts}/{Title}{/block:Posts}";
        expect(
            render(page, { Title: "blog", Posts: [{ Title: "post" }, {}] }),
        ).toBe("blog/post/blog");
    });

    test("a brace Tumblr does not know is left alone", () => {
        expect(render("a{color:red}{e}{Body}", {})).toBe("a{color:red}{e}");
    });

    test("a template with every block dropped carries no tags at all", () => {
        for (const source of templates)
            expect(render(source, {})).not.toMatch(/\{\/?block:/);
    });
});

describe("stamp", () => {
    const theme = (body: string) =>
        `<head><meta name="theme-hash" content="${THEME_HASH_PLACEHOLDER}"></head>${body}`;

    test("stamping is idempotent, and carries the theme's own hash", () => {
        for (const source of templates.slice(0, 50)) {
            const once = stamp(theme(source));
            expect(stamp(once)).toBe(once);
            expect(readStamp(once)).toBe(themeHash(theme(source)));
        }
    });

    test("a change to the theme changes its stamp", () => {
        expect(readStamp(stamp(theme("a")))).not.toBe(
            readStamp(stamp(theme("b"))),
        );
    });
});

describe("navbar links", () => {
    const site = new URL(SITE_URL);
    const hosts: Host[] = ["site", "tumblr"];

    test("off the site, every link names its host", () => {
        for (const link of navLinks)
            expect(hrefFor(link, "tumblr", site)).toMatch(/^https:\/\//);
    });

    test("on each host, exactly one entry is where the reader is", () => {
        const places: Record<Host, string> = {
            site: "/fiction/some-story/",
            tumblr: "/",
        };
        for (const host of hosts)
            expect(
                navLinks.filter((link) => isCurrent(link, host, places[host])),
            ).toHaveLength(1);
    });

    test("a page the navbar does not list has no current entry", () => {
        expect(
            navLinks.filter((link) => isCurrent(link, "site", "/design/")),
        ).toEqual([]);
    });
});

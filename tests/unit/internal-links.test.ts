import { describe, expect, test } from "vitest";
import { brokenLinks } from "../../src/integrations/internal-links";

/** A build holding these files. */
const built = (...files: string[]) => {
    const all = new Set(files);
    return (path: string) => all.has(path);
};

const exists = built(
    "/index.html",
    "/fiction/index.html",
    "/fiction/out/index.html",
    "/scheduled/fiction/later/index.html",
    "/rss.xml",
);

describe("brokenLinks", () => {
    test("a link to a built page, however it is spelled, is not broken", () => {
        const hrefs = [
            "/",
            "/fiction",
            "/fiction/",
            "/fiction/out#part",
            "/rss.xml",
        ];
        expect(brokenLinks([{ file: "index.html", hrefs }], exists)).toEqual(
            [],
        );
    });

    test("only links to this site's root are checked", () => {
        const hrefs = [
            "https://example.com/",
            "//example.com/",
            "#part",
            "out",
        ];
        expect(brokenLinks([{ file: "index.html", hrefs }], exists)).toEqual(
            [],
        );
    });

    test("a published page may not link to a scheduled one", () => {
        expect(
            brokenLinks(
                [
                    {
                        file: "fiction/out/index.html",
                        hrefs: ["/fiction/later/"],
                    },
                ],
                exists,
            ),
        ).toEqual(["/fiction/later/ on /fiction/out/index.html"]);
    });

    test("a scheduled page may link to one, by the path it will have", () => {
        expect(
            brokenLinks(
                [
                    {
                        file: "scheduled/fiction/later/index.html",
                        hrefs: ["/fiction/later/", "/fiction/out/"],
                    },
                ],
                exists,
            ),
        ).toEqual([]);
    });

    test("fixtures may link to nothing, on purpose", () => {
        expect(
            brokenLinks(
                [
                    { file: "fixtures/sink/index.html", hrefs: ["/nowhere"] },
                    {
                        file: "scheduled/fixtures/sink/index.html",
                        hrefs: ["/nowhere"],
                    },
                ],
                exists,
            ),
        ).toEqual([]);
    });
});

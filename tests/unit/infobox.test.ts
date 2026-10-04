import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parse, text } from "~/components/mdx/links/html";
import { infoboxFields, MAX_FIELDS } from "~/components/mdx/links/infobox";

/**
 * Parsoid's rendering of a real article, recorded once from
 * https://en.wikipedia.org/api/rest_v1/page/html/Wang_Xizhi/1376319871 so the
 * test runs offline. Its infobox has more labelled rows than the cap, footnote
 * markers, line breaks, links relative to the article, and a nested sub-box
 * of transcriptions whose rows are not the infobox's own.
 */
const ARTICLE = "https://en.wikipedia.org/wiki/Wang_Xizhi";
const html = readFileSync(
    new URL("fixtures/wikipedia-wang-xizhi.html", import.meta.url),
    "utf8",
);
const fields = infoboxFields(html, ARTICLE);
const value = (label: string) =>
    text(parse(fields.find((field) => field.label === label)?.value ?? ""));

describe("infoboxFields", () => {
    test("reads the infobox's labelled rows, in order, up to the cap", () => {
        expect(fields.map((field) => field.label)).toEqual([
            "Born",
            "Died",
            "Known for",
            "Notable work",
            "Family",
            "Chinese",
        ]);
        expect(fields).toHaveLength(MAX_FIELDS);
    });

    test("drops footnote markers", () => {
        expect(value("Died")).not.toMatch(/\[\d+\]/);
        expect(fields.some((field) => field.value.includes("reference"))).toBe(
            false,
        );
    });

    test("lays line breaks out as commas", () => {
        expect(value("Born")).toMatch(/^c\. 303, Linyi County/);
        expect(value("Died")).toMatch(/^c\. 361 \(aged 58\), Xiaojia Village/);
    });

    test("points the article's links back at Wikipedia", () => {
        expect(value("Known for")).toBe("Chinese calligraphy");
        expect(fields.find((f) => f.label === "Known for")?.value).toContain(
            'href="https://en.wikipedia.org/wiki/Chinese_calligraphy"',
        );
        expect(fields.every((field) => !field.value.includes('href="./'))).toBe(
            true,
        );
    });

    test("flattens lists to commas, and nested ones too", () => {
        const [field] = infoboxFields(
            `<table class="infobox"><tbody><tr>
                <th class="infobox-label">Works</th>
                <td class="infobox-data"><ul>
                    <li>One</li>
                    <li>Two<ul><li>Two A</li><li>Two B</li></ul></li>
                </ul><br></td>
            </tr></tbody></table>`,
            ARTICLE,
        );
        expect(field?.value).not.toMatch(/<\/?(ul|ol|li|br)\b/);
        expect(text(parse(field!.value))).toMatch(
            /^One\s*,\s*Two\s*,?\s*Two A\s*,\s*Two B$/,
        );
    });

    test("leaves out what the template hides", () => {
        const [field] = infoboxFields(
            `<table class="infobox"><tbody><tr>
                <th class="infobox-label">Born</th>
                <td class="infobox-data">303<span style="display:none">hidden</span><span class="noprint">edit</span></td>
            </tr></tbody></table>`,
            ARTICLE,
        );
        expect(field?.value).toBe("303");
    });

    test("gives a coordinate once, as the article shows it", () => {
        const [field] = infoboxFields(
            `<table class="infobox"><tbody><tr>
                <th class="infobox-label">Coordinates</th>
                <td class="infobox-data"><span class="geo-default">35°21′39″N</span><span class="geo-multi-punct"> / </span><span class="geo-nondefault">35.36083°N</span></td>
            </tr></tbody></table>`,
            ARTICLE,
        );
        expect(text(parse(field!.value))).toBe("35°21′39″N");
    });

    test("an article with no infobox has no fields", () => {
        expect(infoboxFields("<p>No box here.</p>", ARTICLE)).toEqual([]);
    });
});

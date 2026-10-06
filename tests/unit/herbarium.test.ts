import { codeToHast } from "shiki";
import type { Element, Nodes } from "hast";
import { describe, expect, test } from "vitest";
import { herbarium, tokenClasses, TOKENS } from "~/plugins/herbarium";

/** Code in the site's languages, covering every kind of token. */
const SAMPLES = {
    scss: `@use "sass:math";\n// A frame.\n@mixin frame($rule, $width: 3px) {\n    border: $width solid var(--color-text);\n    width: math.div(100%, 2);\n}`,
    ts: `import { x } from "y";\n/** Doubled. */\nexport function double(n: number): number {\n    const twice = n * 2;\n    return Math.max(twice, 0) ?? null;\n}`,
    css: `:root {\n    --color-text: #0e100f;\n}\np::before {\n    content: "§";\n    color: rgb(0 0 0 / 50%);\n}`,
    astro: `---\nconst { title } = Astro.props;\n---\n<h1 class="title">{title}</h1>`,
    sh: `#!/usr/bin/env bash\nfor f in *.svg; do\n    echo "$f" # each\ndone`,
};

/** An element's classes; Shiki writes `class`, not hast's `className`. */
const classes = (element: Element) =>
    [element.properties.class ?? element.properties.className ?? []]
        .flat()
        .flatMap((name) => String(name).split(" "))
        .filter(Boolean);

const elements = (node: Nodes): Element[] =>
    "children" in node
        ? [
              ...(node.type === "element" ? [node] : []),
              ...node.children.flatMap((child) => elements(child as Nodes)),
          ]
        : [];

describe("Herbarium", () => {
    test("every kind of token takes in some scopes", () => {
        for (const [kind, scopes] of Object.entries(TOKENS))
            expect(scopes.length, kind).toBeGreaterThan(0);
    });

    for (const [lang, code] of Object.entries(SAMPLES)) {
        test(`${lang}: nothing is left styled inline, and every class is a token's`, async () => {
            const tree = await codeToHast(code, {
                lang,
                theme: herbarium,
                transformers: [tokenClasses],
            });
            const kinds = new Set(Object.keys(TOKENS).map((k) => `tok-${k}`));
            const used = new Set<string>();
            for (const element of elements(tree)) {
                expect(element.properties.style, lang).toBeUndefined();
                if (element.tagName !== "span") continue;
                for (const name of classes(element))
                    if (name !== "line") {
                        expect(kinds.has(String(name)), String(name)).toBe(
                            true,
                        );
                        used.add(String(name));
                    }
            }
            expect(used.size, `${lang} has tokens to ink`).toBeGreaterThan(1);
        });
    }

    test("between them, the samples ink every kind of token", async () => {
        const used = new Set<string>();
        for (const [lang, code] of Object.entries(SAMPLES)) {
            const tree = await codeToHast(code, {
                lang,
                theme: herbarium,
                transformers: [tokenClasses],
            });
            for (const element of elements(tree))
                for (const name of classes(element)) used.add(String(name));
        }
        for (const kind of Object.keys(TOKENS))
            expect(used.has(`tok-${kind}`), kind).toBe(true);
    });
});

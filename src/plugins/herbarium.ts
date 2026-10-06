/**
 * Herbarium: syntax highlighting in the site's own pigments.
 *
 * Shiki writes a theme's colours inline on every token, where no stylesheet
 * can re-ink them for the reader's scheme. This theme's "colours" are instead
 * names, `var(--tok-<kind>)`. The transformer turns each into a class,
 * `tok-<kind>`, and strips every inline style. prelude.scss sets what each
 * kind looks like in each scheme.
 *
 * Shiki's `css-variables` theme is not used: it gives numbers and built-ins
 * one variable, and they are coloured differently here.
 */
import type { ShikiTransformer, ThemeRegistration } from "shiki";

/** Each kind of token drawn apart from the text, with the TextMate scopes it covers. */
export const TOKENS = {
    keyword: [
        "keyword",
        "storage",
        "keyword.control",
        "keyword.other",
        "entity.name.tag",
        "punctuation.definition.keyword",
    ],
    variable: [
        "variable",
        "support.variable",
        "variable.css",
        "variable.scss",
        "variable.parameter",
    ],
    literal: [
        "string",
        "punctuation.definition.string",
        "constant.numeric",
        "constant.language",
        "constant.character",
        "constant.other.color",
        "keyword.other.unit",
    ],
    builtin: [
        "support.function",
        "support.type",
        "support.class",
        "support.constant",
        "entity.name.type",
    ],
    function: ["entity.name.function", "meta.function-call entity.name"],
    comment: ["comment", "punctuation.definition.comment"],
} as const satisfies Record<string, readonly string[]>;

export type Token = keyof typeof TOKENS;

/**
 * Scopes caught by the broad ones above that read better as plain text:
 * operators, ordinary names in a script (unlike a stylesheet's `$variable`),
 * and property names, since `builtin` is for values the language supplies.
 */
const PLAIN = [
    "keyword.operator",
    "support.type.property-name",
    "variable.other.readwrite",
    "variable.other.object",
    "variable.other.property",
    "punctuation",
];

const name = (kind: Token | "plain") => `var(--tok-${kind})`;

export const herbarium: ThemeRegistration = {
    name: "herbarium",
    type: "light",
    colors: {
        "editor.foreground": name("plain"),
        "editor.background": "transparent",
    },
    tokenColors: [
        { scope: PLAIN, settings: { foreground: name("plain") } },
        ...Object.entries(TOKENS).map(([kind, scope]) => ({
            scope: [...scope],
            settings: { foreground: name(kind as Token) },
        })),
    ],
};

/** Turns the theme's names into classes and strips inline styles. */
export const tokenClasses: ShikiTransformer = {
    name: "herbarium-token-classes",
    pre(node) {
        delete node.properties.style;
    },
    span(node) {
        const kind = /var\(--tok-([a-z]+)\)/.exec(
            String(node.properties.style ?? ""),
        )?.[1];
        delete node.properties.style;
        if (kind && kind !== "plain") this.addClassToHast(node, `tok-${kind}`);
    },
};

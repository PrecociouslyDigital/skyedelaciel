/**
 * Builders for the MDX nodes a remark plugin writes into a page: a component
 * and the imports it needs. MDX compiles these from their estree, not their
 * source text, so each carries both; the text is what a reader of the tree
 * sees, and the estree is what runs.
 */
import type { Expression, Program } from "estree";
import type { RootContent } from "mdast";
import type {
    MdxJsxAttribute,
    MdxJsxFlowElement,
    MdxJsxTextElement,
} from "mdast-util-mdx-jsx";
import type { MdxjsEsm } from "mdast-util-mdxjs-esm";

/** An identifier the page has imported, to pass as a prop by reference. */
export interface Imported {
    identifier: string;
}

/** What a prop can be: written out, or a value the page imported. */
export type Prop = string | number | Imported;

const program = (body: Program["body"]): Program => ({
    type: "Program",
    sourceType: "module",
    body,
});

/** `import identifier from "source"`, at the top of the page. */
export function importDefault(identifier: string, source: string): MdxjsEsm {
    const literal = JSON.stringify(source);
    return {
        type: "mdxjsEsm",
        value: `import ${identifier} from ${literal}`,
        data: {
            estree: program([
                {
                    type: "ImportDeclaration",
                    specifiers: [
                        {
                            type: "ImportDefaultSpecifier",
                            local: { type: "Identifier", name: identifier },
                        },
                    ],
                    source: { type: "Literal", value: source, raw: literal },
                    attributes: [],
                },
            ]),
        },
    };
}

function attribute(name: string, value: Prop): MdxJsxAttribute {
    if (typeof value === "string")
        return { type: "mdxJsxAttribute", name, value };
    const [text, expression]: [string, Expression] =
        typeof value === "number"
            ? [String(value), { type: "Literal", value, raw: String(value) }]
            : [
                  value.identifier,
                  { type: "Identifier", name: value.identifier },
              ];
    return {
        type: "mdxJsxAttribute",
        name,
        value: {
            type: "mdxJsxAttributeValueExpression",
            value: text,
            data: {
                estree: program([{ type: "ExpressionStatement", expression }]),
            },
        },
    };
}

const attributes = (props: Record<string, Prop | undefined>) =>
    Object.entries(props).flatMap(([name, value]) =>
        value === undefined ? [] : [attribute(name, value)],
    );

/** `<name {...props}>children</name>`, standing as a block of its own. */
export const block = (
    name: string,
    props: Record<string, Prop | undefined>,
    children: MdxJsxFlowElement["children"] = [],
): MdxJsxFlowElement => ({
    type: "mdxJsxFlowElement",
    name,
    attributes: attributes(props),
    children,
});

/**
 * `<name {...props}>children</name>`, holding a run of text. Set into a
 * block's children, it is how a component is handed a named slot of inline
 * content (a caption, a credit) without a paragraph round it.
 */
export const inline = (
    name: string,
    props: Record<string, Prop | undefined>,
    children: MdxJsxTextElement["children"],
): MdxJsxFlowElement =>
    // A flow element holding phrasing is what MDX itself parses
    // `<span>*a*</span>` on a line of its own into; mdast's types do not
    // allow for it, but every stage after them does.
    block(
        name,
        props,
        children as RootContent[] as MdxJsxFlowElement["children"],
    );

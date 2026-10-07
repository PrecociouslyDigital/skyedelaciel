/**
 * Remark plugin: numbers what a page sets apart, gives each an address of its
 * own, and fills in the text of a link to one. Images, blocks of code and
 * tables are figures; definitions, lemmas and theorems are statements. Each
 * of the two is numbered within its top-level section (see numbering.ts).
 *
 *     ![What it shows](./images/fuji.jpg "Why it is here.")
 *
 *     Credit: Photograph by Someone · [CC BY-SA 4.0](https://…)
 *
 *     Table: What the table holds.
 *
 *     | … |
 *
 *     ```scss title="What the code does"
 *
 *     <dl><dt>What the term is</dt><dd>…</dd></dl>
 *
 *     <Theorem name="What it is called">…</Theorem>
 *
 *     As [](#fig-fuji) shows…   →   As Figure 3.2 shows…
 *
 * An image stands alone in its paragraph, with alt text saying what it shows
 * and a title saying why it is there, which becomes its caption. A credit is
 * the paragraph after it, if that begins `Credit:`. A table's caption is the
 * paragraph before it, beginning `Table:`, and is required. A block of code's
 * caption is its fence's title, which is optional; a fence takes nothing
 * else. A `<Lemma>` or `<Theorem>` takes a name, which is optional, and
 * nothing else. Anything else (a figure missing either text, a stray caption
 * or credit, two things with one id, a link to one that is not there) fails
 * the build where it stands.
 *
 * An image's id is its file's name, a table's or a block of code's its
 * caption's, a definition's its term and a lemma's or theorem's its name, so
 * MDX, which cannot carry `{#id}`, needs none written. A block of code, lemma
 * or theorem without a name is known by its number and cannot be cited.
 */
import type { RemarkPlugin } from "@astrojs/markdown-remark";
import { imageMetadata } from "astro/assets/utils";
import type {
    Code,
    Heading,
    Image,
    Node,
    Paragraph,
    Parent,
    PhrasingContent,
    Root,
    RootContent,
    Table,
} from "mdast";
import type { MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { readFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import { match } from "ts-pattern";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { store } from "../integrations/drawn";
import { plate, plated } from "../layouts/prelude/brush.mjs";
import { block, importDefault, recast, slot } from "./mdx-nodes";
import {
    captionLabel,
    DanglingReference,
    DuplicateId,
    KINDS,
    namesApparatus,
    numberApparatus,
    referenceText,
    SECTION_ATTRIBUTE,
} from "./numbering";

/** The widest a figure is drawn, and the tallest, in px. */
export const MAX_WIDTH = 640;
export const MAX_HEIGHT = 720;

/** What the paragraph that captions a table begins with. */
const TABLE = "Table:";
/** What the paragraph that credits an image begins with. */
const CREDIT = "Credit:";

/** The text of some markdown, without its markup. */
const toString = (node: Node | Node[]): string =>
    Array.isArray(node)
        ? node.map(toString).join("")
        : "value" in node
          ? String(node.value)
          : "children" in node
            ? toString(node.children as Node[])
            : "";

/** A paragraph that begins with a marker, and what it says after it. */
interface Marked {
    node: Paragraph;
    text: PhrasingContent[];
}

/** `node`, if it is a paragraph that begins with `marker`. */
function marked(node: RootContent | undefined, marker: string): Marked | null {
    if (node?.type !== "paragraph") return null;
    const [first, ...rest] = node.children;
    if (first?.type !== "text" || !first.value.startsWith(marker)) return null;
    const after = first.value.slice(marker.length).trimStart();
    return {
        node,
        text: after ? [{ ...first, value: after }, ...rest] : rest,
    };
}

/** The image a paragraph holds and nothing else, if it holds one. */
function lone(node: Paragraph): Image | null {
    const meant = node.children.filter(
        (child) => !(child.type === "text" && !child.value.trim()),
    );
    return meant.length === 1 && meant[0]!.type === "image" ? meant[0] : null;
}

/**
 * Where a thing stands: the number of its top-level section, if it is in one.
 * Each thing below is also its own apparatus: `kind` is what it is numbered
 * as, so that an image and a block of code are both figures, and `name` is
 * what its id is made from.
 */
interface Placed {
    section?: string;
}

/** An image, named for its file, less its extension. */
interface ImageFigure extends Placed {
    form: "image";
    kind: "figure";
    name: string;
    node: Paragraph;
    image: Image;
    alt: string;
    caption: string;
    credit?: Marked;
}

/** A table, named for its caption. */
interface TableFigure extends Placed {
    form: "table";
    kind: "table";
    name: string;
    node: Table;
    caption: Marked;
}

/** A block of code, named for its fence's title if it has one. */
interface CodeFigure extends Placed {
    form: "code";
    kind: "figure";
    name?: string;
    node: Code;
}

/** A term a definition list defines, named for itself. */
interface DefinedTerm extends Placed {
    form: "term";
    kind: "definition";
    name: string;
    node: MdxJsxFlowElement | MdxJsxTextElement;
}

/** A lemma or a theorem, written `<Theorem name="…">…</Theorem>`. */
interface Statement extends Placed {
    form: "statement";
    kind: "lemma" | "theorem";
    name?: string;
    node: MdxJsxFlowElement;
}

type SetApart =
    | ImageFigure
    | TableFigure
    | CodeFigure
    | DefinedTerm
    | Statement;

/** Each element a statement is written as, `<Lemma>` or `<Theorem>`, and its kind. */
const STATEMENTS = new Map<string, "lemma" | "theorem">(
    (["lemma", "theorem"] as const).map((kind) => [KINDS[kind].label, kind]),
);

/**
 * The number of the top-level section a heading opens or stands in: "3" for
 * § 3.2. remark-sections has put it on the heading already.
 */
function topSection(heading: Heading, file: VFile): string {
    const number = heading.data?.hProperties?.[SECTION_ATTRIBUTE];
    if (typeof number !== "string")
        file.fail(
            "this heading has no section number; remark-sections runs before remark-figures.",
            heading,
        );
    return number.split(".")[0]!;
}

/** What a lemma or theorem may say: a name, name="…", and nothing else. */
function statementName(node: MdxJsxFlowElement, file: VFile) {
    const [first, ...rest] = node.attributes;
    if (
        rest.length > 0 ||
        (first &&
            (first.type !== "mdxJsxAttribute" ||
                first.name !== "name" ||
                typeof first.value !== "string"))
    )
        file.fail(
            `a ${node.name} takes a name, name="…", and nothing else.`,
            node,
        );
    return first?.value as string | undefined;
}

/** What a fence may say after its language: a title, and nothing else. */
const FENCE = /^title="([^"]+)"$/;

/**
 * Where everything set apart sits, in document order, with its captions.
 * Whatever is malformed fails the build here, so what comes back is whole.
 */
function survey(tree: Root, file: VFile) {
    const found: SetApart[] = [];
    const captions = new Set<Paragraph>();
    const claimed = new Set<Paragraph>();
    const parents = new Map<Node, Parent>();
    let section: string | undefined;

    visit(tree, (node, index, parent) => {
        if (parent) parents.set(node, parent);
        if (node.type === "heading") section = topSection(node, file);
        const statement =
            node.type === "mdxJsxFlowElement" &&
            STATEMENTS.get(node.name ?? "");
        if (statement)
            found.push({
                form: "statement",
                kind: statement,
                name: statementName(node, file),
                node,
                section,
            });
        if (node.type === "imageReference")
            file.fail(
                'write an image inline, ![alt](./file "caption"), so that it can be a figure.',
                node,
            );
        if (node.type === "table") {
            const caption =
                marked(parent!.children[index! - 1], TABLE) ??
                file.fail(
                    `a table needs a \`${TABLE} caption\` paragraph right before it.`,
                    node,
                );
            claimed.add(caption.node);
            found.push({
                form: "table",
                kind: "table",
                name: toString(caption.text),
                node,
                caption,
                section,
            });
        }
        if (node.type === "code") {
            const meta = node.meta?.trim() ?? "";
            const title = FENCE.exec(meta)?.[1];
            if (meta && !title)
                file.fail(
                    `a fence takes a title, title="…", and nothing else; this one says ${meta}.`,
                    node,
                );
            found.push({
                form: "code",
                kind: "figure",
                name: title,
                node,
                section,
            });
        }
        if (
            (node.type === "mdxJsxFlowElement" ||
                node.type === "mdxJsxTextElement") &&
            node.name === "dt"
        )
            found.push({
                form: "term",
                kind: "definition",
                name: toString(node),
                node,
                section,
            });
        if (node.type !== "paragraph") return;
        if (marked(node, TABLE) || marked(node, CREDIT)) captions.add(node);
        const image = lone(node);
        if (image) {
            if (!image.alt?.trim())
                file.fail(
                    "a figure needs alt text, saying what it shows.",
                    image,
                );
            if (!image.title?.trim())
                file.fail(
                    'a figure needs a caption, as its title: ![alt](./file "caption").',
                    image,
                );
            if (!/^\.\.?\//.test(image.url))
                file.fail(
                    "a figure's image is a file beside the page, by a relative path.",
                    image,
                );
            const credit = marked(parent!.children[index! + 1], CREDIT);
            if (credit) claimed.add(credit.node);
            found.push({
                form: "image",
                kind: "figure",
                name: basename(image.url, extname(image.url)),
                node,
                image,
                alt: image.alt,
                caption: image.title,
                credit: credit ?? undefined,
                section,
            });
        } else if (node.children.some((child) => child.type === "image")) {
            file.fail(
                "an image is a figure, and stands alone in its paragraph.",
                node,
            );
        }
    });

    for (const caption of captions) {
        if (!claimed.has(caption))
            file.fail(
                `this caption belongs to nothing: \`${TABLE}\` goes right before a table, and \`${CREDIT}\` right after an image.`,
                caption,
            );
    }
    return { found, parents };
}

/** The size a figure is drawn at, in px: no wider or taller than the page allows. */
export function drawnSize(natural: { width: number; height: number }) {
    const aspect = natural.width / natural.height;
    const width = Math.round(
        Math.min(natural.width, MAX_WIDTH, MAX_HEIGHT * aspect),
    );
    // Rounding the width of a sliver can lengthen it past the limit.
    return { width, height: Math.min(MAX_HEIGHT, Math.round(width / aspect)) };
}

/** A node of the page, and what takes its place: a component, or nothing. */
type Replacement = [Node, RootContent | null];

const remarkFigures: RemarkPlugin<[{ root: URL }]> =
    ({ root }) =>
    async (tree: Root, file) => {
        const { found, parents } = survey(tree, file);

        let numbered;
        try {
            numbered = numberApparatus(found);
        } catch (error) {
            if (error instanceof DuplicateId)
                file.fail(error.message, found[error.index]!.node);
            throw error;
        }

        const imports: RootContent[] = [];
        const replaced = new Map<Node, RootContent | null>();

        for (const [i, thing] of numbered.entries()) {
            const label = captionLabel(thing);
            const replacements = await match(thing)
                .returnType<Replacement[] | Promise<Replacement[]>>()
                .with({ form: "term" }, ({ node, id }) => [
                    [node, recast(node, "Term", { id, label })],
                ])
                .with({ form: "statement" }, ({ node, id, name }) => [
                    [node, recast(node, "Statement", { id, label, name })],
                ])
                .with({ form: "code" }, ({ node, id, name }) => [
                    [
                        node,
                        block(
                            "CodeFigure",
                            {
                                id,
                                label,
                                caption: name,
                                lang: node.lang ?? "text",
                                lines: node.value.split("\n").length,
                            },
                            [node],
                        ),
                    ],
                ])
                .with({ form: "table" }, ({ node, id, caption }) => [
                    [caption.node, null],
                    [
                        node,
                        block("TableFigure", { id, label }, [
                            slot("caption", caption.text),
                            node,
                        ]),
                    ],
                ])
                .with({ form: "image" }, async (figure) => {
                    const { image, credit } = figure;
                    const path = resolve(dirname(file.path), image.url);
                    const natural = await imageMetadata(
                        await readFile(path),
                        path,
                    );
                    const { width, height } = drawnSize(natural);
                    const drawing = store(
                        root,
                        plate({
                            width: plated(width),
                            height: plated(height),
                            seed: figure.id,
                        }),
                    );

                    const [picture, frame] = [`__figure${i}`, `__plate${i}`];
                    imports.push(
                        importDefault(picture, image.url),
                        importDefault(frame, `${drawing}?url`),
                    );
                    const figured = block(
                        "Figure",
                        {
                            id: figure.id,
                            label,
                            image: { identifier: picture },
                            alt: figure.alt,
                            plate: { identifier: frame },
                            width,
                        },
                        [
                            slot("caption", [
                                { type: "text", value: figure.caption },
                            ]),
                            ...(credit ? [slot("credit", credit.text)] : []),
                        ],
                    );
                    return [
                        [figure.node, figured],
                        ...(credit ? [[credit.node, null] as Replacement] : []),
                    ];
                })
                .exhaustive();
            for (const [node, replacement] of replacements)
                replaced.set(node, replacement);
        }

        for (const parent of new Set(
            [...replaced.keys()].map((node) => parents.get(node)!),
        )) {
            parent.children = parent.children.flatMap((child) => {
                const replacement = replaced.get(child);
                if (replacement === undefined) return [child];
                return replacement ? [replacement] : [];
            }) as Parent["children"];
        }

        visit(tree, "link", (link) => {
            if (!namesApparatus(link.url)) return;
            let text: string;
            try {
                text = referenceText(numbered, link.url);
            } catch (error) {
                if (error instanceof DanglingReference)
                    file.fail(error.message, link);
                throw error;
            }
            if (!toString(link).trim())
                link.children = [{ type: "text", value: text }];
        });

        tree.children.unshift(...imports);
    };

export default remarkFigures;

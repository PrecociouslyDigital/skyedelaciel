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
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { store } from "../integrations/drawn";
import { PLATE_PAD, plate } from "../layouts/prelude/brush.mjs";
import { block, importDefault, inline, recast } from "./mdx-nodes";
import {
    captionLabel,
    DanglingReference,
    DuplicateId,
    namesApparatus,
    numberApparatus,
    referenceText,
    type Apparatus,
} from "./numbering";

/** The widest a figure is drawn, and the tallest, in px. */
const MAX_WIDTH = 640;
const MAX_HEIGHT = 720;

/** The text of some markdown, without its markup. */
const toString = (node: Node | Node[]): string =>
    Array.isArray(node)
        ? node.map(toString).join("")
        : "value" in node
          ? String(node.value)
          : "children" in node
            ? toString(node.children as Node[])
            : "";

/** A paragraph that begins with `marker`, less the marker. */
function marked(node: Paragraph, marker: string): PhrasingContent[] | null {
    const [first, ...rest] = node.children;
    if (first?.type !== "text" || !first.value.startsWith(marker)) return null;
    const after = first.value.slice(marker.length).trimStart();
    return after ? [{ ...first, value: after }, ...rest] : rest;
}

/** The image a paragraph holds and nothing else, if it holds one. */
function lone(node: Paragraph): Image | null {
    const meant = node.children.filter(
        (child) => !(child.type === "text" && !child.value.trim()),
    );
    return meant.length === 1 && meant[0]!.type === "image" ? meant[0] : null;
}

/** Where a thing stands: the number of its top-level section, if it is in one. */
interface Placed {
    section?: string;
}

interface ImageFigure extends Placed {
    kind: "image";
    node: Paragraph;
    image: Image;
    credit?: Paragraph;
}

interface TableFigure extends Placed {
    kind: "table";
    node: Table;
    caption: Paragraph;
}

interface CodeFigure extends Placed {
    kind: "code";
    node: Code;
    title?: string;
}

interface DefinedTerm extends Placed {
    kind: "term";
    node: MdxJsxFlowElement | MdxJsxTextElement;
}

/** A lemma or a theorem, written `<Theorem name="…">…</Theorem>`. */
interface Statement extends Placed {
    kind: "lemma" | "theorem";
    node: MdxJsxFlowElement;
    name?: string;
}

type SetApart =
    | ImageFigure
    | TableFigure
    | CodeFigure
    | DefinedTerm
    | Statement;

/**
 * The number of the top-level section a heading opens or stands in: "3" for
 * § 3.2. remark-sections has put it on the heading already.
 */
function topSection(heading: Heading, file: VFile): string {
    const number = heading.data?.hProperties?.["data-section"];
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

/** Where everything set apart sits, in document order, with its captions. */
function survey(tree: Root, file: VFile) {
    const found: SetApart[] = [];
    const captions = new Set<Paragraph>();
    const claimed = new Set<Paragraph>();
    const parents = new Map<Node, Parent>();
    let section: string | undefined;

    visit(tree, (node, index, parent) => {
        if (parent) parents.set(node, parent);
        if (node.type === "heading") section = topSection(node, file);
        if (
            node.type === "mdxJsxFlowElement" &&
            (node.name === "Theorem" || node.name === "Lemma")
        )
            found.push({
                kind: node.name === "Theorem" ? "theorem" : "lemma",
                node,
                name: statementName(node, file),
                section,
            });
        if (node.type === "imageReference")
            file.fail(
                'write an image inline, ![alt](./file "caption"), so that it can be a figure.',
                node,
            );
        if (node.type === "table") {
            const before = parent!.children[index! - 1];
            const caption =
                before?.type === "paragraph" && marked(before, "Table:")
                    ? before
                    : file.fail(
                          "a table needs a `Table: caption` paragraph right before it.",
                          node,
                      );
            claimed.add(caption);
            found.push({ kind: "table", node, caption, section });
        }
        if (node.type === "code") {
            const meta = node.meta?.trim() ?? "";
            const title = FENCE.exec(meta)?.[1];
            if (meta && !title)
                file.fail(
                    `a fence takes a title, title="…", and nothing else; this one says ${meta}.`,
                    node,
                );
            found.push({ kind: "code", node, title, section });
        }
        if (
            (node.type === "mdxJsxFlowElement" ||
                node.type === "mdxJsxTextElement") &&
            node.name === "dt"
        )
            found.push({ kind: "term", node, section });
        if (node.type !== "paragraph") return;
        if (marked(node, "Table:") || marked(node, "Credit:"))
            captions.add(node);
        const image = lone(node);
        if (image) {
            const after = parent!.children[index! + 1];
            const credit =
                after?.type === "paragraph" && marked(after, "Credit:")
                    ? after
                    : undefined;
            if (credit) claimed.add(credit);
            found.push({ kind: "image", node, image, credit, section });
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
                "this caption belongs to nothing: `Table:` goes right before a table, and `Credit:` right after an image.",
                caption,
            );
    }
    return { found, parents };
}

/**
 * What a thing is numbered as, and what its id is made from: an image's
 * file, less its extension, a table's caption, a block of code's title or a
 * lemma's or theorem's name if it has one, or a definition's term. Images and
 * code are numbered as figures alike.
 */
function apparatusOf(item: SetApart): Apparatus {
    const { section } = item;
    switch (item.kind) {
        case "image":
            return {
                kind: "figure",
                name: basename(item.image.url, extname(item.image.url)),
                section,
            };
        case "table":
            return {
                kind: "table",
                name: toString(marked(item.caption, "Table:")!),
                section,
            };
        case "code":
            return { kind: "figure", name: item.title, section };
        case "term":
            return { kind: "definition", name: toString(item.node), section };
        case "lemma":
        case "theorem":
            return { kind: item.kind, name: item.name, section };
    }
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

const remarkFigures: RemarkPlugin<[{ root: URL }]> =
    ({ root }) =>
    async (tree: Root, file) => {
        const { found, parents } = survey(tree, file);

        let numbered;
        try {
            numbered = numberApparatus(found.map(apparatusOf));
        } catch (error) {
            if (error instanceof DuplicateId)
                file.fail(error.message, found[error.index]!.node);
            throw error;
        }

        const imports: RootContent[] = [];
        const replaced = new Map<Node, RootContent | null>();

        for (const [i, item] of found.entries()) {
            const thing = numbered[i]!;
            const label = captionLabel(thing);

            if (item.kind === "term") {
                replaced.set(
                    item.node,
                    recast(item.node, "Term", { id: thing.id, label }),
                );
                continue;
            }

            if (item.kind === "lemma" || item.kind === "theorem") {
                replaced.set(
                    item.node,
                    recast(item.node, "Statement", {
                        id: thing.id,
                        label,
                        name: item.name,
                    }),
                );
                continue;
            }

            if (item.kind === "code") {
                replaced.set(
                    item.node,
                    block(
                        "CodeFigure",
                        {
                            id: thing.id,
                            label,
                            caption: item.title,
                            lang: item.node.lang ?? "text",
                            lines: item.node.value.split("\n").length,
                        },
                        [item.node],
                    ),
                );
                continue;
            }

            if (item.kind === "table") {
                replaced.set(item.caption, null);
                replaced.set(
                    item.node,
                    block("TableFigure", { id: thing.id, label }, [
                        inline(
                            "span",
                            { slot: "caption" },
                            marked(item.caption, "Table:")!,
                        ),
                        item.node,
                    ]),
                );
                continue;
            }

            const { image, credit } = item;
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

            const path = resolve(dirname(file.path), image.url);
            const natural = await imageMetadata(await readFile(path), path);
            const { width, height } = drawnSize(natural);
            const drawing = store(
                root,
                plate({
                    width: width + 2 * PLATE_PAD,
                    height: height + 2 * PLATE_PAD,
                    seed: thing.id,
                }),
            );

            const [picture, frame] = [`__figure${i}`, `__plate${i}`];
            imports.push(
                importDefault(picture, image.url),
                importDefault(frame, `${drawing}?url`),
            );
            if (credit) replaced.set(credit, null);
            replaced.set(
                item.node,
                block(
                    "Figure",
                    {
                        id: thing.id,
                        label,
                        image: { identifier: picture },
                        alt: image.alt!,
                        plate: { identifier: frame },
                        width,
                    },
                    [
                        inline("span", { slot: "caption" }, [
                            { type: "text", value: image.title! },
                        ]),
                        ...(credit
                            ? [
                                  inline(
                                      "span",
                                      { slot: "credit" },
                                      marked(credit, "Credit:")!,
                                  ),
                              ]
                            : []),
                    ],
                ),
            );
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

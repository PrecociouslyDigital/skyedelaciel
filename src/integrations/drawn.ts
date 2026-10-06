import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Where drawings are kept, under the project root: generated, not committed. */
const DRAWINGS = ".astro/drawings/";

/** The directory drawings are kept in, as a path with forward slashes. */
export const drawingsDir = (root: URL) =>
    fileURLToPath(new URL(DRAWINGS, root)).replaceAll("\\", "/");

/**
 * Keep a drawing as a file, and return the root-relative path Vite serves and
 * fingerprints it from, like any other asset a stylesheet or module names.
 *
 * Files are named by their own content, so they never go stale, and a drawing
 * asked for twice is written once.
 */
export function store(root: URL, svg: string): string {
    const name = `${createHash("sha256").update(svg).digest("hex").slice(0, 16)}.svg`;
    const dir = new URL(DRAWINGS, root);
    const path = fileURLToPath(new URL(name, dir));
    if (!existsSync(path)) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(path, svg);
    }
    return `/${DRAWINGS}${name}`;
}

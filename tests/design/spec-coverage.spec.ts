import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The spec and the suite are joined by section name, and this is the joint.
 *
 * `.claude/CLAUDE.md` asks in prose that design.mdx "should always be
 * accurate". Prose cannot enforce itself: a section renamed in the spec, or one
 * added with no test behind it, is exactly the drift that goes unnoticed. This
 * test makes both of those go red.
 *
 * Runs in its own Playwright project because it reads files, not pages.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SPEC = join(here, "../../src/content/design.mdx");

/** The `##` headings — one level down from the spec's structural `#` parts. */
function specSections(): string[] {
    const body = readFileSync(SPEC, "utf8").replace(
        /^---\n[\s\S]*?\n---\n/,
        "",
    );
    return [...body.matchAll(/^## (?!#)(.+)$/gm)].map((match) =>
        match[1]!.trim(),
    );
}

/** The names passed to `section(...)` across every spec file. */
function claimedSections(): Map<string, string[]> {
    const claims = new Map<string, string[]>();
    for (const file of readdirSync(here)) {
        if (!file.endsWith(".spec.ts")) continue;
        const source = readFileSync(join(here, file), "utf8");
        for (const match of source.matchAll(/^section\("([^"]+)"/gm)) {
            const name = match[1]!;
            claims.set(name, [...(claims.get(name) ?? []), file]);
        }
    }
    return claims;
}

test("every section of design.mdx is enforced by a test", () => {
    const claimed = claimedSections();
    const unclaimed = specSections().filter((name) => !claimed.has(name));
    expect(
        unclaimed,
        "design.mdx sections with no test file claiming them",
    ).toEqual([]);
});

test("every test claims a section design.mdx still has", () => {
    const sections = new Set(specSections());
    const orphaned = [...claimedSections()]
        .filter(([name]) => !sections.has(name))
        .map(([name, files]) => `${name} (claimed by ${files.join(", ")})`);
    expect(
        orphaned,
        "tests claiming sections that design.mdx no longer has",
    ).toEqual([]);
});

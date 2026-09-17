import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { outputs, renderLogo } from "../../tools/logo.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * The mark is generated, and a generated file that has been edited by hand is
 * a file the generator will silently undo. Committed and generated have to be
 * the same bytes, so that either editing the artwork directly or changing the
 * parameters without re-running `node tools/logo.mjs` goes red here.
 */
describe("the served mark is the drawn mark", () => {
    for (const { file, params } of outputs) {
        test(`${file} is what the generator draws`, () => {
            expect(readFileSync(join(repoRoot, file), "utf8")).toBe(
                renderLogo(params),
            );
        });
    }
});

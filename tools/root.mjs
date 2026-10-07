// @ts-check
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The repository's root directory, one up from `tools/`. */
export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

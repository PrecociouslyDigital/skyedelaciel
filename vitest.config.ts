import { getViteConfig } from "astro/config";
import { defineConfig } from "vitest/config";

/**
 * Wrapping Astro's own Vite config is what makes `~/*` imports, `?raw` imports
 * (cite.ts loads its CSL style that way) and `astro:*` modules resolve the same
 * way in a test as they do in a build.
 *
 * `defineConfig` is here only to type the `test` block: since Vitest 5 it no
 * longer augments Vite's own config type, so a bare object literal would be
 * rejected as having an unknown `test` property.
 */
export default getViteConfig(
    defineConfig({
        test: {
            include: ["tests/unit/**/*.test.ts"],
            environment: "node",
        },
    }),
);

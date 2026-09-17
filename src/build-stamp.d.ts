/**
 * Facts about the build itself, stamped in by `vite.define` in
 * astro.config.mts, where they are read off the checkout and the clock.
 *
 * Declared rather than imported because that is what `define` substitutes: a
 * bare identifier, replaced before anything runs. md.astro reads both for the
 * rail slug — see design.mdx, Annotation.
 */

/** The short SHA this build was made from, or "" outside a git checkout. */
declare const __GIT_REVISION__: string;

/** The day this build was made, as YYYY-MM-DD. */
declare const __BUILD_DATE__: string;

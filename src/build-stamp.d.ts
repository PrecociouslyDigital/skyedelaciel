/**
 * A fact about the build itself, stamped in by `vite.define` in
 * astro.config.mts, where it is read off the checkout.
 *
 * Declared rather than imported because that is what `define` substitutes: a
 * bare identifier, replaced before anything runs. md.astro reads it for the
 * rail slug — see design.mdx, Annotation.
 */

/** The short SHA this build was made from, or "" outside a git checkout. */
declare const __GIT_REVISION__: string;

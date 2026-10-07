/**
 * What this build includes beyond the site itself. Plain TS, without
 * `astro:content`, so that the integrations and the content config can read
 * it as well as the routes.
 */

/**
 * Fixtures are a test surface rather than content, so a plain `astro build`
 * routes none of them; `npm run build:fixtures` sets INCLUDE_FIXTURES to add
 * them.
 */
export const INCLUDE_FIXTURES = Boolean(process.env.INCLUDE_FIXTURES);

/** The directory under src/content the fixtures live in, and are built under. */
export const FIXTURES_DIR = "fixtures";

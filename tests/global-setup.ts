import { testPort } from "../tools/browser/profiles.mjs";

/**
 * Refuse to run against a server that is not serving the fixture build.
 *
 * `reuseExistingServer` is what makes repeat runs quick, and it is also the way
 * this goes wrong: a server left over from a plain `astro build` answers on the
 * port, Playwright reuses it, the `build:fixtures` step never runs, and every
 * fixture-backed test fails for a reason that has nothing to do with the spec.
 *
 * One reachability check turns that into one legible sentence.
 */
export default async function globalSetup() {
    const url = `http://localhost:${testPort}/fixtures/kitchen-sink/`;
    const response = await fetch(url).catch(() => null);

    if (!response?.ok) {
        throw new Error(
            `The server on port ${testPort} is not serving the fixture pages ` +
                `(${url} → ${response ? response.status : "unreachable"}).\n` +
                "It is probably left over from a plain `astro build`. Stop it, " +
                "or run `npm run build:fixtures` before retrying.",
        );
    }
}

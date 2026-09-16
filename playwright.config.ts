import { defineConfig } from "@playwright/test";
import { profiles, testPort } from "./tools/browser/profiles.mjs";

/**
 * One project per profile, out of the same table `tools/browse` drives, so a
 * browser checked by hand and a browser checked by the suite cannot diverge.
 *
 * CSS media type has no `use:` option, so tests/design/_harness.ts applies it
 * from the same table as an automatic fixture.
 */
const browsers = Object.entries(profiles).map(([name, profile]) => ({
    name,
    testIgnore: /spec-coverage\.spec\.ts/,
    use: {
        viewport: profile.viewport,
        javaScriptEnabled: profile.javaScriptEnabled,
    },
}));

export default defineConfig({
    testDir: "tests/design",
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],

    use: {
        baseURL: `http://localhost:${testPort}`,
        trace: "retain-on-failure",
    },

    projects: [
        // Reads files rather than pages, so it runs once rather than per browser.
        { name: "spec", testMatch: /spec-coverage\.spec\.ts/ },
        ...browsers,
    ],

    // A reused server that predates this port's fixture build would be tested
    // silently; global-setup.ts checks for exactly that and says so.
    globalSetup: "./tests/global-setup.ts",

    // Fixtures are only routable in a build that asked for them, so the suite
    // makes its own, on a port of its own. `reuseExistingServer` keeps repeat
    // runs quick.
    webServer: {
        command: `npm run build:fixtures && npx astro preview --port ${testPort}`,
        url: `http://localhost:${testPort}/design/`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
    },
});

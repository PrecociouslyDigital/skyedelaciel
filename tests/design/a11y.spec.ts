import AxeBuilder from "@axe-core/playwright";
import { expect, FIXTURE_PAGE, onlyIn, SPEC_PAGE, test } from "./_harness";

/**
 * Not tied to a section of design.mdx: the spec asks throughout for screen
 * reader support "with aria tags where appropriate", and the repo has
 * hand-written aria-label, role="doc-noteref" and role="tooltip" that nothing
 * else checks.
 *
 * Only serious and critical findings fail. Lesser ones are advisory and would
 * otherwise turn the suite into something to be ignored.
 */
const BLOCKING = new Set(["serious", "critical"]);

// axe runs *in* the page, so it has nothing to say in the nojs profile beyond
// its own timeout; and its colour rules describe a screen, not paper.
onlyIn("wide", "narrow");

for (const path of [SPEC_PAGE, FIXTURE_PAGE]) {
    test(`no serious accessibility violations on ${path}`, async ({ page }) => {
        await page.goto(path);

        const { violations } = await new AxeBuilder({ page }).analyze();
        const blocking = violations
            .filter((violation) => BLOCKING.has(violation.impact ?? ""))
            .map((violation) => ({
                id: violation.id,
                impact: violation.impact,
                help: violation.help,
                targets: violation.nodes.map((node) => node.target.join(" ")),
            }));

        expect(blocking).toEqual([]);
    });
}

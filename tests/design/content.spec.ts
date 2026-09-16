import { expect, FIXTURE_PAGE, section, SPEC_PAGE, test } from "./_harness";

section("Content", () => {
    for (const path of [SPEC_PAGE, FIXTURE_PAGE]) {
        test(`the measure is at most 80 characters (${path})`, async ({
            page,
        }) => {
            await page.goto(path);

            // Measured in the font the page actually rendered with, rather than
            // trusting the `80ch` in the stylesheet to mean what it says.
            const { article, eighty } = await page.evaluate(() => {
                const body = getComputedStyle(document.body);
                const probe = document.createElement("span");
                probe.textContent = "0".repeat(80);
                probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${body.font}`;
                document.body.append(probe);
                const eighty = probe.getBoundingClientRect().width;
                probe.remove();
                return {
                    article: document
                        .querySelector("article")!
                        .getBoundingClientRect().width,
                    eighty,
                };
            });

            expect(article).toBeLessThanOrEqual(eighty + 1);
        });
    }
});

import { test as base, expect } from "@playwright/test";
import type { Profile, ProfileName } from "../../tools/browser/profiles.mjs";
import { profiles } from "../../tools/browser/profiles.mjs";

export { expect };

/**
 * The two pages the suite reads.
 *
 * `/design` is the spec rendering itself, which is the most honest thing to
 * check it against. The fixture covers what that page happens not to exercise —
 * a bibliography, all four popover styles, crowded sidenotes.
 */
export const SPEC_PAGE = "/design/";
export const FIXTURE_PAGE = "/fixtures/kitchen-sink/";

export const test = base.extend<{
    profileName: ProfileName;
    profile: Profile;
}>({
    profileName: async ({}, use, testInfo) => {
        await use(testInfo.project.name as ProfileName);
    },

    /**
     * Automatic, because CSS media type is not something Playwright lets a
     * project declare — and a `print` project that quietly rendered as `screen`
     * would pass every print test for the wrong reason.
     */
    profile: [
        async ({ profileName, page }, use) => {
            const profile = profiles[profileName];
            await page.emulateMedia({ media: profile.media });
            await use(profile);
        },
        { auto: true },
    ],
});

/**
 * Name the design.mdx section this file enforces.
 *
 * The name is the join between spec and suite: spec-coverage.spec.ts reads
 * these calls out of the test sources and checks them against the headings of
 * design.mdx in both directions, so neither can move without the other.
 */
export function section(name: string, body: () => void) {
    test.describe(name, body);
}

/** Restrict the enclosing block to the profiles a claim is actually about. */
export const onlyIn = (...names: ProfileName[]) =>
    test.skip(
        ({ profileName }) => !names.includes(profileName),
        `only meaningful in: ${names.join(", ")}`,
    );

/** Every profile whose layout the spec describes as wide. */
export const WIDE: ProfileName[] = ["wide", "nojs"];

/**
 * Links in the prose.
 *
 * The bibliography's entries carry `.content-link` as well, but they are works
 * cited rather than links in the text — every claim the Links section of the
 * spec makes is about the latter.
 */
export const PROSE_LINKS = "article a.content-link:not(.bibliography a)";

/** Rectangles as `boundingBox()` gives them, or null for a hidden element. */
export type Box = { x: number; y: number; width: number; height: number };

/** Do two rendered rectangles share any area at all? */
export const overlaps = (a: Box, b: Box) =>
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height;

/**
 * WCAG relative luminance of an `rgb(r, g, b)` string, and the contrast ratio
 * between two of them. Both the Colors section and the print scheme reason
 * about "quieter" and "louder" text, which is this and nothing else.
 */
export function luminance(color: string): number {
    const [r, g, b] = [...color.matchAll(/\d+(\.\d+)?/g)]
        .slice(0, 3)
        .map((match) => {
            const channel = Number(match[0]) / 255;
            return channel <= 0.03928
                ? channel / 12.92
                : ((channel + 0.055) / 1.055) ** 2.4;
        }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const contrast = (a: string, b: string) => {
    const [dark, light] = [luminance(a), luminance(b)].sort((x, y) => x - y);
    return (light! + 0.05) / (dark! + 0.05);
};

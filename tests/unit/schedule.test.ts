import { describe, expect, test } from "vitest";
import type { LoaderContext } from "astro/loaders";
import { existsSync, readFileSync } from "node:fs";
import { partitioned } from "~/content/partitioned";
import { day, isPublished, SCHEDULED_PREFIX, today } from "~/content/schedule";
import { chance } from "~/layouts/prelude/chance.mjs";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Instants and days drawn from 1970 to 2100, by seed. */
const FROM = Date.UTC(1970, 0, 1);
const TO = Date.UTC(2100, 0, 1);
const instant = (seed: number) =>
    new Date(Math.floor(chance(seed).between(FROM, TO)));
const someDay = (seed: number) => day(instant(seed));
const SEEDS = Array.from({ length: 500 }, (_, n) => n);

/** A frontmatter date, as YAML hands one over: UTC midnight. */
const dated = (d: string) => new Date(`${d}T00:00:00Z`);

/** An instant on Los Angeles's wall clock, at the given UTC offset in hours. */
const losAngeles = (wall: string, offset: number) =>
    new Date(Date.parse(`${wall}Z`) - offset * HOUR);

describe("day", () => {
    test("reads back the day that was written", () => {
        for (const seed of SEEDS) {
            const written = someDay(seed);
            expect(day(dated(written))).toBe(written);
        }
    });
});

describe("today", () => {
    test("is the UTC date seven or eight hours earlier, as LA's offset is", () => {
        for (const seed of SEEDS) {
            const now = instant(seed);
            expect([
                day(new Date(now.getTime() - 7 * HOUR)),
                day(new Date(now.getTime() - 8 * HOUR)),
            ]).toContain(today(now));
        }
    });

    test("never goes backward", () => {
        for (const seed of SEEDS) {
            const [a, b] = [instant(seed), instant(seed + 1e6)].sort(
                (x, y) => x.getTime() - y.getTime(),
            );
            expect(today(a!) <= today(b!)).toBe(true);
        }
    });

    /* 2026's clock changes, when a wall-clock minute either side of midnight
       is a different number of real minutes from it. */
    test.each([
        ["2026-03-07T23:59:00", -8, "2026-03-07"],
        ["2026-03-08T00:00:00", -8, "2026-03-08"],
        ["2026-03-08T23:59:00", -7, "2026-03-08"],
        ["2026-03-09T00:00:00", -7, "2026-03-09"],
        ["2026-10-31T23:59:00", -7, "2026-10-31"],
        ["2026-11-01T00:00:00", -7, "2026-11-01"],
        ["2026-11-01T23:59:00", -8, "2026-11-01"],
        ["2026-11-02T00:00:00", -8, "2026-11-02"],
    ])("at %s, UTC%i, it is %s", (wall, offset, expected) => {
        expect(today(losAngeles(wall, offset))).toBe(expected);
    });
});

describe("isPublished", () => {
    test("a page is out exactly when its day has come in LA", () => {
        for (const seed of SEEDS) {
            const published = someDay(seed);
            const now = instant(seed + 1e6);
            expect(isPublished(dated(published), now)).toBe(
                published <= today(now),
            );
        }
    });

    test("once out, a page stays out", () => {
        for (const seed of SEEDS) {
            const published = dated(someDay(seed));
            const now = instant(seed + 1e6);
            if (isPublished(published, now)) {
                expect(
                    isPublished(published, new Date(now.getTime() + DAY)),
                ).toBe(true);
            }
        }
    });

    /* The daily rebuild is what moves a page out. It has to land on every LA
       day exactly once — which a fixed UTC time does only if it falls on the
       same LA day as its UTC date, under either offset. */
    test("the daily rebuild runs once on every LA day", () => {
        const workflow = readFileSync(".github/workflows/site.yml", "utf8");
        const [, minute, hour] =
            /cron:\s*"(\d+) (\d+) \* \* \*"/.exec(workflow) ?? [];
        expect(minute, "site.yml runs on a daily cron").toBeDefined();

        for (let at = Date.UTC(2026, 0, 1); at < Date.UTC(2031, 0, 1); ) {
            const run = new Date(
                at + Number(hour) * HOUR + Number(minute) * 60_000,
            );
            expect(today(run)).toBe(day(new Date(at)));
            at += DAY;
        }
    });
});

/**
 * As much of Astro's glob loader as the split depends on: an entry it already
 * holds unchanged is not set again, and one whose file is gone is dropped.
 */
function filesLoader(files: { id: string; published: string }[]) {
    return {
        name: "files",
        load: async ({ store }: LoaderContext) => {
            const untouched = new Set(store.keys());
            for (const { id, published } of files) {
                untouched.delete(id);
                if (store.get(id)?.digest === published) continue;
                store.set({
                    id,
                    data: { published: dated(published) },
                    digest: published,
                });
            }
            untouched.forEach((id) => store.delete(id));
        },
    };
}

/** The parts of a collection's store that a loader reaches for. */
function memoryStore() {
    const held = new Map<string, { id: string; data: any; digest?: string }>();
    return {
        get: (id: string) => held.get(id),
        set: (entry: { id: string; data: any; digest?: string }) => {
            held.set(entry.id, entry);
            return true;
        },
        delete: (id: string) => void held.delete(id),
        values: () => [...held.values()],
        keys: () => [...held.keys()],
        entries: () => [...held.entries()],
        has: (id: string) => held.has(id),
    };
}

describe("pages and scheduled", () => {
    test("every article is in exactly one, and moves on its day", async () => {
        for (const seed of SEEDS.slice(0, 50)) {
            const r = chance(seed);
            const start = Date.UTC(2026, 0, 1);
            const files = Array.from({ length: 12 }, (_, n) => ({
                id: `piece-${n}`,
                published: day(new Date(start + r.integer(60) * DAY)),
            }));
            const stores = { pages: memoryStore(), scheduled: memoryStore() };

            // Daily builds over the same span, against stores that persist
            // from one build to the next, as Astro's data store does.
            for (let at = start; at < start + 62 * DAY; at += DAY) {
                const now = new Date(at + 8 * HOUR);
                const out = (data: Record<string, unknown>) =>
                    isPublished(data.published as Date, now);
                for (const [name, keep] of [
                    ["pages", out],
                    [
                        "scheduled",
                        (data: Record<string, unknown>) => !out(data),
                    ],
                ] as const) {
                    await partitioned(filesLoader(files), keep).load({
                        store: stores[name],
                    } as unknown as LoaderContext);
                }

                const pages = new Set(stores.pages.keys());
                const scheduled = new Set(stores.scheduled.keys());
                for (const { id, published } of files) {
                    expect(
                        [pages.has(id), scheduled.has(id)],
                        `${id} on ${today(now)}`,
                    ).toEqual(
                        published <= today(now) ? [true, false] : [false, true],
                    );
                }
            }
        }
    });
});

/**
 * The prefix is named once, in schedule.ts, and the three things that act on
 * it must all be acting on the same one: the route that builds under it, the
 * header that keeps it out of search, and the Access rule that keeps it to
 * the author.
 */
describe("SCHEDULED_PREFIX", () => {
    test("is the directory the scheduled route lives in", () => {
        expect(
            existsSync(`src/pages/${SCHEDULED_PREFIX}/[...slug].astro`),
        ).toBe(true);
    });

    test("is the path public/_headers marks noindex", () => {
        expect(readFileSync("public/_headers", "utf8")).toMatch(
            new RegExp(
                `^/${SCHEDULED_PREFIX}/\\*\\s+X-Robots-Tag: noindex`,
                "m",
            ),
        );
    });

    test("is what the Access setup reads, rather than its own copy", () => {
        const setup = readFileSync("tools/cloudflare/setup.sh", "utf8");
        expect(setup).toContain("src/content/schedule.ts");
        expect(setup).not.toContain(`/${SCHEDULED_PREFIX}`);
    });
});

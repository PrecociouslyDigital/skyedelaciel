import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as z from "zod";
import type { LinkEntry, ResolvedLink } from "./types";
import { linkEntry, resolvedLink } from "./types";
import { FIXTURES_DIR, INCLUDE_FIXTURES } from "../../../content/included";

const MANUAL_CACHE = "manual-links.json";

/**
 * Real lookups for the fixture pages' links, recorded once so the design suite
 * needs no network and doesn't change when those pages do. Only a fixture
 * build reads them: an article linking the same URL gets it fresh.
 */
const FIXTURE_CACHE = `src/content/${FIXTURES_DIR}/links.json`;
const CACHE_PATH = ".link-cache.json";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Raise this whenever a resolver learns to fetch something new. Once the new
 * fields are optional, old entries still parse, so the schema can't tell a
 * stale entry from a link with nothing more to say. Only the version can.
 */
const CACHE_VERSION = 2;

/** Hand-authored overrides are resolved by definition, so they needn't say so. */
const manualFile = z.record(
    z.string(),
    resolvedLink.extend({
        resolution: z.literal("resolved").default("resolved"),
    }),
);

const cacheEntry = z.object({ meta: linkEntry, ts: z.number() });
type CacheEntries = Record<string, z.infer<typeof cacheEntry>>;

const cacheFile = z.object({
    version: z.literal(CACHE_VERSION),
    entries: z.record(z.string(), z.unknown()),
});

let manual: z.infer<typeof manualFile> = {};
let cache: CacheEntries = {};

/**
 * Git-tracked overrides: a typo in one would silently blank popovers across the
 * site, so let zod fail the build instead.
 */
const loadManual = (path: string): z.infer<typeof manualFile> =>
    existsSync(path)
        ? manualFile.parse(JSON.parse(readFileSync(path, "utf-8")))
        : {};

/** Load cache from disk. Safe to call multiple times (idempotent after first). */
export function loadCache(): void {
    manual = {
        ...loadManual(MANUAL_CACHE),
        ...(INCLUDE_FIXTURES ? loadManual(FIXTURE_CACHE) : {}),
    };
    cache = loadDisposable();
}

/**
 * The fetched cache is regenerable and gitignored, so anything that no longer
 * matches the schema is dropped and re-resolved rather than failing the build.
 * A file written by another version is dropped whole.
 */
function loadDisposable(): CacheEntries {
    let raw: unknown;
    try {
        raw = JSON.parse(readFileSync(CACHE_PATH, "utf-8"));
    } catch {
        return {};
    }
    const file = cacheFile.safeParse(raw);
    if (!file.success) return {};

    const entries = Object.entries(file.data.entries).flatMap(
        ([url, value]) => {
            const parsed = cacheEntry.safeParse(value);
            return parsed.success ? [[url, parsed.data] as const] : [];
        },
    );
    return Object.fromEntries(entries);
}

export function getCached(url: string): LinkEntry | undefined {
    const override = manual[url];
    if (override) return override;

    const entry = cache[url];
    if (!entry) return undefined;
    if (Date.now() - entry.ts > TTL_MS) {
        delete cache[url];
        return undefined;
    }
    return entry.meta;
}

/** Cache a resolved link; failed lookups are handled by the caller and never cached. */
export function setCached(url: string, meta: ResolvedLink): void {
    cache[url] = { meta, ts: Date.now() };
}

/** Persist cache to disk. */
export function saveCache(): void {
    const file: z.infer<typeof cacheFile> = {
        version: CACHE_VERSION,
        entries: cache,
    };
    writeFileSync(CACHE_PATH, JSON.stringify(file, null, 2));
}

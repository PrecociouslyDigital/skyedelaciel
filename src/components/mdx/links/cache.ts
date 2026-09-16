import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as z from "zod";
import type { LinkEntry, ResolvedLink } from "./types";
import { linkEntry, resolvedLink } from "./types";

const MANUAL_CACHE = "manual-links.json";
const CACHE_PATH = ".link-cache.json";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Hand-authored overrides are resolved by definition, so they needn't say so. */
const manualFile = z.record(
    z.string(),
    resolvedLink.extend({
        resolution: z.literal("resolved").default("resolved"),
    }),
);

const cacheEntry = z.object({ meta: linkEntry, ts: z.number() });
const cacheFile = z.record(z.string(), cacheEntry);

let manual: z.infer<typeof manualFile> = {};
let cache: z.infer<typeof cacheFile> = {};

/** Load cache from disk. Safe to call multiple times (idempotent after first). */
export function loadCache(): void {
    // Hand-authored and git-tracked: a typo here would silently blank popovers
    // across the site, so let zod fail the build instead.
    manual = existsSync(MANUAL_CACHE)
        ? manualFile.parse(JSON.parse(readFileSync(MANUAL_CACHE, "utf-8")))
        : {};
    cache = loadDisposable();
}

/**
 * The fetched cache is regenerable and gitignored, so anything that no longer
 * matches the schema is dropped and re-resolved rather than failing the build.
 */
function loadDisposable(): z.infer<typeof cacheFile> {
    let raw: unknown;
    try {
        raw = JSON.parse(readFileSync(CACHE_PATH, "utf-8"));
    } catch {
        return {};
    }
    if (typeof raw !== "object" || raw === null) return {};

    const entries = Object.entries(raw).flatMap(([url, value]) => {
        const parsed = cacheEntry.safeParse(value);
        return parsed.success ? [[url, parsed.data] as const] : [];
    });
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
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

import { readFileSync, writeFileSync } from "node:fs";
import type { LinkEntry } from "./types";

const CACHE_PATH = ".link-cache.json";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
    meta: LinkEntry;
    ts: number;
}

let cache: Record<string, CacheEntry> = {};

/** Load cache from disk. Safe to call multiple times (idempotent after first). */
export function loadCache(): void {
    try {
        cache = JSON.parse(readFileSync(CACHE_PATH, "utf-8"));
    } catch {
        cache = {};
    }
}

export function getCached(url: string): LinkEntry | undefined {
    const entry = cache[url];
    if (!entry) return undefined;
    if (Date.now() - entry.ts > TTL_MS) {
        delete cache[url];
        return undefined;
    }
    return entry.meta;
}

export function setCached(url: string, meta: LinkEntry): void {
    cache[url] = { meta, ts: Date.now() };
}

/** Persist cache to disk. */
export function saveCache(): void {
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

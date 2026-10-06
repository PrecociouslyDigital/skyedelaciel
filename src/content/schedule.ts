/**
 * When a page is out. An article dated in the future is scheduled: it is built
 * only under `/${SCHEDULED_PREFIX}/`, which Cloudflare Access keeps to the
 * author, and the first build on its day moves it to its own path.
 */

/** The zone whose calendar decides what day it is. */
export const PUBLISHING_ZONE = "America/Los_Angeles";

/** The path segment every scheduled page is built under. */
export const SCHEDULED_PREFIX = "scheduled";

/** A calendar day, as `YYYY-MM-DD`, which sorts as it reads. */
export type Day = string;

/**
 * The day a frontmatter date names. YAML reads `published: 2026-10-05` as UTC
 * midnight, so reading it back out in UTC returns the day that was written;
 * any other zone would move half the world's pages by a day.
 */
export const day = (date: Date): Day => date.toISOString().slice(0, 10);

/** `en-CA` is the locale that formats a date as `YYYY-MM-DD`. */
const calendar = new Intl.DateTimeFormat("en-CA", {
    timeZone: PUBLISHING_ZONE,
});

/** What day it is in `PUBLISHING_ZONE` at `now`. */
export const today = (now = new Date()): Day => calendar.format(now);

/** Whether a page dated `published` is out at `now`. */
export const isPublished = (published: Date, now = new Date()): boolean =>
    day(published) <= today(now);

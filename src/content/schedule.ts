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

const HAN_DIGITS = "零一二三四五六七八九";

/** 1–31 in Han numerals: 五, 十, 十一, 二十, 二十五, 三十一. */
const hanCount = (n: number): string => {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return (
        (tens === 0 ? "" : (tens > 1 ? HAN_DIGITS[tens] : "") + "十") +
        (ones === 0 ? "" : HAN_DIGITS[ones])
    );
};

/** A day as the rail writes it, the year digit by digit: 二零二六年九月五日. */
export const hanDay = (date: Date): string => {
    const [year, month, dayOfMonth] = day(date).split("-").map(Number);
    const digits = [...String(year)].map((digit) => HAN_DIGITS[+digit]);
    return `${digits.join("")}年${hanCount(month!)}月${hanCount(dayOfMonth!)}日`;
};

/** `en-CA` is the locale that formats a date as `YYYY-MM-DD`. */
const calendar = new Intl.DateTimeFormat("en-CA", {
    timeZone: PUBLISHING_ZONE,
});

/** What day it is in `PUBLISHING_ZONE` at `now`. */
export const today = (now = new Date()): Day => calendar.format(now);

/** Whether a page dated `published` is out at `now`. */
export const isPublished = (published: Date, now = new Date()): boolean =>
    day(published) <= today(now);

/**
 * Progressive enhancement for the sidebar's table of contents: follow the
 * reader. The entry for whatever they are reading is current — coloured,
 * unfolded, and boxed by the tracker — and every other entry folds away.
 * Without JS, sections remain collapsed but manually expandable.
 *
 * What the reader is in is decided by position, not by what last crossed the
 * top of the screen: the current entry is the last whose target begins above
 * the reading line. A heading's section, or a post, therefore stays current
 * for as long as any of it is under that line, in either direction of scroll.
 *
 * The page ends before its last few targets can reach a line near the top, so
 * over the last screenful of scrolling the line slides down to the bottom of
 * the viewport. Every entry is current in turn, and the last is current at the
 * end of the page.
 */

/** Where reading happens, as a fraction of the viewport: near the top. */
const READING_LINE = 0.05;

function readingLine() {
    const left = document.documentElement.scrollHeight - innerHeight - scrollY;
    const ending = Math.max(0, 1 - left / innerHeight);
    return innerHeight * (READING_LINE + (1 - READING_LINE) * ending);
}

const toc = document.querySelector<HTMLElement>(".toc-sidebar");

/** Each in-page entry, with what it points at, in document order. */
const entries = [
    ...(toc?.querySelectorAll<HTMLAnchorElement>('a[href^="#"]') ?? []),
].flatMap((link) => {
    const target = document.getElementById(
        decodeURIComponent(link.hash.slice(1)),
    );
    return target ? [{ link, target }] : [];
});

/**
 * Put the tracker box around the current entry and whatever it unfolded.
 *
 * The box is `.toc-root`'s own ::before — see toc.scss — so all that crosses
 * between here and the stylesheet is where it goes and how tall it is.
 * Measured after the unfolding, since opening a section moves everything
 * under it.
 */
function trackCurrent(entry: HTMLElement) {
    const list = entry.closest<HTMLElement>(".toc-root");
    if (!list) return;

    list.style.setProperty("--toc-tracker-top", `${entry.offsetTop}px`);
    list.style.setProperty("--toc-tracker-height", `${entry.offsetHeight}px`);
}

function makeCurrent(link: HTMLAnchorElement | undefined) {
    if (!toc) return;

    toc.querySelector("a[data-current]")?.removeAttribute("data-current");
    toc.querySelectorAll("details[open]").forEach((d) =>
        d.removeAttribute("open"),
    );
    if (!link) return;

    link.setAttribute("data-current", "");

    // Unfold the entry's own section, and every section it sits in.
    const entry = link.parentElement!;
    entry.querySelector(":scope > details")?.setAttribute("open", "");
    for (
        let section = entry.closest("details");
        section && toc.contains(section);
        section = section.parentElement!.closest("details")
    ) {
        section.setAttribute("open", "");
    }

    trackCurrent(entry);
}

let current: HTMLAnchorElement | undefined;
let pending = false;

function follow() {
    pending = false;
    const line = readingLine();
    const next = entries.findLast(
        ({ target }) => target.getBoundingClientRect().top <= line,
    )?.link;

    if (next !== current) makeCurrent((current = next));
}

/** At most once a frame, however fast the scroll events come. */
function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(follow);
}

if (entries.length > 0) {
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule, { passive: true });
    follow();
}

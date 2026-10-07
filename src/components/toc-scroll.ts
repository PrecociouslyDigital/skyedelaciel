/**
 * Progressive enhancement for the sidebar's table of contents: follow the
 * reader. The entry for whatever they are reading is current — coloured,
 * unfolded, and boxed by the tracker — and every other section folds away.
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

/**
 * Where the current entry is brought to when the contents scroll on their
 * own, as a fraction of their height: high, so that what it unfolded shows
 * below it. It is only moved once it is outside `KEPT_BETWEEN`.
 */
const KEPT_AT = 0.25;
const KEPT_BETWEEN = [0.1, 0.75] as const;

function readingLine() {
    const left = document.documentElement.scrollHeight - innerHeight - scrollY;
    const ending = Math.max(0, 1 - left / innerHeight);
    return innerHeight * (READING_LINE + (1 - READING_LINE) * ending);
}

const toc = document.querySelector<HTMLElement>(".toc-sidebar");
const root = toc?.querySelector<HTMLElement>(".toc-root");

/** Each in-page entry, with what it points at, in document order. */
const entries = [
    ...(toc?.querySelectorAll<HTMLAnchorElement>('a[href^="#"]') ?? []),
].flatMap((link) => {
    const target = document.getElementById(
        decodeURIComponent(link.hash.slice(1)),
    );
    return target ? [{ link, target }] : [];
});

/** One of the lengths toc.scss registers on the list, in pixels. */
const registered = (list: HTMLElement, name: string) =>
    parseFloat(getComputedStyle(list).getPropertyValue(name));

/**
 * A length in pixels, for a custom property. Not a template literal: this
 * script is inlined into the Tumblr theme, where a minified `${a-b}` would
 * read as one of Tumblr's own `{Variables}`.
 */
const px = (n: number) => n + "px";

/** Where a link's words are, without the space around them. */
function words(link: HTMLAnchorElement) {
    const range = document.createRange();
    range.selectNodeContents(link);
    return range.getBoundingClientRect();
}

/**
 * Put the tracker box around the current entry and whatever it unfolded.
 *
 * The box is `.toc-root`'s own ::before — see toc.scss — so all that crosses
 * between here and the stylesheet is where it goes and how big it is. Down
 * the list it spans the entry, and on the words' side it hugs them. On the
 * vine's side, which in the sidebar is the right, only a whole section — an
 * entry with what it unfolded — is boxed out past the vine it grows on. A
 * single entry, at any level, stops short of the vine and of its marks.
 */
function track() {
    const link = current;
    if (!link || !root) return;

    const entry = link.parentElement!;
    const shown = [...entry.querySelectorAll("a")].filter((a) =>
        a.checkVisibility(),
    );
    // Its section has only just been told to open, and shows nothing yet:
    // it is measured again as soon as it starts to grow.
    if (shown.length === 0) return;

    const texts = shown.map(words);
    const hug = registered(root, "--toc-hug");
    const list = root.getBoundingClientRect();
    const box = entry.getBoundingClientRect();

    const left = Math.min(...texts.map((text) => text.left)) - hug;
    const right =
        shown.length > 1
            ? list.right + registered(root, "--toc-outset")
            : Math.min(
                  texts[0]!.right + hug,
                  list.right - registered(root, "--toc-clear"),
              );

    root.style.setProperty("--toc-tracker-left", px(left - list.left));
    root.style.setProperty("--toc-tracker-width", px(right - left));
    root.style.setProperty("--toc-tracker-top", px(box.top - list.top));
    root.style.setProperty("--toc-tracker-height", px(box.height));
}

/**
 * When the contents are taller than the sidebar leaves them and scroll on
 * their own, bring the current entry into view — the contents' view, not
 * the page's.
 */
function keepInView() {
    if (!toc || !current || toc.scrollHeight <= toc.clientHeight) return;

    const height = toc.clientHeight;
    const top =
        current.getBoundingClientRect().top - toc.getBoundingClientRect().top;
    if (top >= height * KEPT_BETWEEN[0] && top <= height * KEPT_BETWEEN[1])
        return;

    toc.scrollBy({
        top: top - height * KEPT_AT,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
    });
}

/**
 * Once everything the last change set growing or folding has come to rest,
 * measure again and bring the current entry into view. Only what runs on the
 * clock and on something drawn is waited for: the contents' fading ends run on
 * their own scroll, and a folded section's entries are never drawn, so their
 * unresolving never advances. Neither would ever finish.
 */
let settling = 0;
async function settle() {
    const turn = ++settling;
    await new Promise(requestAnimationFrame);
    const moving = toc!
        .getAnimations({ subtree: true })
        .filter(
            ({ timeline, effect }) =>
                timeline === document.timeline &&
                effect instanceof KeyframeEffect &&
                effect.target?.checkVisibility(),
        );
    await Promise.allSettled(moving.map(({ finished }) => finished));
    if (turn !== settling) return;

    track();
    keepInView();
}

function makeCurrent(link: HTMLAnchorElement | undefined) {
    if (!toc) return;

    toc.querySelector("a[data-current]")?.removeAttribute("data-current");
    link?.setAttribute("data-current", "");

    // Only the top level folds: unfold the section the entry is in, or that
    // it heads, and fold every other.
    const section = link
        ?.closest('li[data-depth="1"]')
        ?.querySelector(":scope > details");
    for (const details of toc.querySelectorAll("details")) {
        details.open = details === section;
    }

    track();
    void settle();
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

if (toc && root && entries.length > 0) {
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule, { passive: true });

    // The box follows its entry while sections grow and fold, the reader's
    // own unfolding included. A section's last step, out of sight once it has
    // folded, changes no size, so the end of the fold is caught as well.
    const resized = new ResizeObserver(track);
    resized.observe(root);
    for (const section of root.children) resized.observe(section);
    toc.addEventListener("transitionend", track);

    follow();
}

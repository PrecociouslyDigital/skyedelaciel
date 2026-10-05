import type { Scope } from "~/tumblr/render";

/**
 * A blog to fill the Tumblr theme in with, for the design suite: an index page
 * and one permalink page. Between them they cover what the theme draws
 * differently — a titled post and an untitled one, a reblog with a trail, a
 * post with no tags, one with no notes, and a page of notes. The posts are
 * long enough that the table of contents has to follow the reader through
 * them.
 */

const BLOG = "/fixtures/tumblr/";
const PERMALINK = "/fixtures/tumblr/post/";

const prose = (subject: string, paragraphs: number) =>
    Array.from(
        { length: paragraphs },
        (_, n) =>
            `<p>${subject}, paragraph ${n + 1}. A brush carries five tones of ink, and the hand decides which of them reaches the paper; the stroke is laid down once, and what it says about the hand that laid it cannot be revised. The page keeps a record of the order the strokes were made in, for anyone who knows how to read it.</p>`,
    ).join("");

const day = (n: number) => ({
    Year: "2026",
    Month: "October",
    MonthNumberWithZero: "10",
    DayOfMonth: String(n),
    DayOfMonthWithZero: String(n).padStart(2, "0"),
});

const tags = (...names: string[]): Scope =>
    names.length === 0
        ? { HasTags: false }
        : {
              HasTags: true,
              Tags: names.map((Tag) => ({
                  Tag,
                  TagURL: `${BLOG}tagged/${Tag}`,
              })),
          };

const notes = (count: number): Scope =>
    count === 0
        ? { NoteCount: false }
        : {
              NoteCount: true,
              NoteCountWithLabel: `${count} note${count === 1 ? "" : "s"}`,
          };

const original: Scope = { NotReblog: true, RebloggedFrom: false };

const brushes: Scope = {
    PostID: "101",
    Permalink: PERMALINK,
    ...day(3),
    Text: true,
    Title: "On brushes",
    Body: prose("On brushes", 8),
    ...original,
    ...tags("calligraphy", "tools"),
    ...notes(12),
};

/** A key can be a block and a variable at once: `Quote` both keeps the quote
    block and fills it. */
const posts: Scope[] = [
    brushes,
    {
        PostID: "102",
        Permalink: PERMALINK,
        ...day(2),
        Text: true,
        Title: false,
        NotReblog: false,
        RebloggedFrom: true,
        ReblogParentName: "a-scribe",
        ReblogParentURL: "https://a-scribe.tumblr.com/",
        Reblogs: [
            { Username: "a-scribe", Body: prose("A first hand", 3) },
            { Username: "skyedelaciel", Body: prose("A second hand", 3) },
        ],
        ...tags(),
        ...notes(0),
    },
    {
        PostID: "103",
        Permalink: PERMALINK,
        ...day(1),
        Text: false,
        Title: false,
        Quote: "<p>The brush moves, and the ink follows where it has been.</p>",
        Source: "Wang Xizhi",
        ...tags("quotes"),
        ...notes(1),
    },
];

const blog: Scope = {
    Title: "Skye De La Ciel",
    Description: "<p>Notes, reblogs, and the occasional brush stroke.</p>",
    MetaDescription: "Notes, reblogs, and the occasional brush stroke.",
    RSS: `${BLOG}rss`,
};

export const pages: Record<string, Scope> = {
    "tumblr/": {
        ...blog,
        IndexPage: true,
        PermalinkPage: false,
        Posts: posts,
        Pagination: true,
        NextPage: `${BLOG}page/2`,
    },
    "tumblr/post/": {
        ...blog,
        IndexPage: false,
        PermalinkPage: true,
        PostSummary: "On brushes",
        Posts: [
            {
                ...brushes,
                PostNotes: `<ol class="notes">${[
                    "a-scribe",
                    "inkstone",
                    "seal-cutter",
                ]
                    .map((who) => `<li>${who} liked this</li>`)
                    .join("")}</ol>`,
            },
        ],
    },
};

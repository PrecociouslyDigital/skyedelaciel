/**
 * The part of Tumblr's theme language this theme speaks.
 *
 * A Tumblr theme is one HTML file that Tumblr fills in on its own servers:
 * `{Name}` is replaced by a value, and `{block:Name}…{/block:Name}` is kept,
 * dropped or repeated. Both are written through the names below, so a
 * misspelt one is a type error here rather than a literal "{Titel}" on the
 * blog. See https://www.tumblr.com/docs/en/custom_themes.
 *
 * Several names mean different things in different blocks — `{Title}` is the
 * blog's title at the top level and a post's inside `{block:Text}` — which is
 * Tumblr's scoping, not ours to fix.
 */

export const VARIABLES = [
    // The blog
    "Title",
    "Description",
    "MetaDescription",
    "RSS",
    "PostSummary",
    // A post
    "PostID",
    "Permalink",
    "Body",
    "Year",
    "Month",
    "MonthNumberWithZero",
    "DayOfMonth",
    "DayOfMonthWithZero",
    "NoteCountWithLabel",
    "PostNotes",
    "Tag",
    "TagURL",
    "ReblogParentName",
    "ReblogParentURL",
    "Username",
    // Legacy post types
    "PhotoURL-HighRes",
    "PhotoAlt",
    "Photoset-700",
    "Caption",
    "Quote",
    "Source",
    "URL",
    "Name",
    "Label",
    "Line",
    "Video-700",
    "AudioEmbed",
    "Asker",
    "Question",
    "Answer",
    // Pagination
    "PreviousPage",
    "NextPage",
] as const;

export const BLOCKS = [
    "IndexPage",
    "PermalinkPage",
    "PostSummary",
    "Posts",
    "Pagination",
    "PreviousPage",
    "NextPage",
    "Description",
    // Post types
    "Text",
    "Photo",
    "Photoset",
    "Quote",
    "Link",
    "Chat",
    "Video",
    "Audio",
    "Answer",
    // Within a post
    "Title",
    "Caption",
    "Source",
    "Lines",
    "Label",
    "HasTags",
    "Tags",
    "NoteCount",
    "PostNotes",
    "NotReblog",
    "RebloggedFrom",
    "Reblogs",
] as const;

export type TumblrVariable = (typeof VARIABLES)[number];
export type TumblrBlock = (typeof BLOCKS)[number];

/** A variable, for Tumblr to replace. */
export const v = (name: TumblrVariable) => `{${name}}`;

/** A block around `inner`, for Tumblr to keep, drop or repeat. */
export const block = (name: TumblrBlock, inner: string) =>
    `{block:${name}}${inner}{/block:${name}}`;

/** A post's date as the rest of the site writes one. */
export const date = `${v("Year")}-${v("MonthNumberWithZero")}-${v("DayOfMonthWithZero")}`;

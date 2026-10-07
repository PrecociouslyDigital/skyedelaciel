/** Who the site is by, and so what it is called. */
export const AUTHOR = "Skye De La Ciel";
export const SITE_NAME = AUTHOR;

export const SITE_HOST = "skyedelaciel.com";
export const SITE_URL = `https://${SITE_HOST}`;

// TODO(copy): a placeholder until the introduction is written.
export const SITE_DESCRIPTION =
    "Fiction and nonfiction by a writer and software engineer.";

/** `path` as an address on this site; a full URL elsewhere is kept as it is. */
export const onSite = (path: string) => new URL(path, SITE_URL);

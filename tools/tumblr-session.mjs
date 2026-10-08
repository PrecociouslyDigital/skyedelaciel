#!/usr/bin/env node
// @ts-check
/**
 * Store this machine's Tumblr session as the repository's TUMBLR_SESSION
 * secret, since CI is turned away when it logs in afresh. Opens the theme
 * editor, logging in if need be, and pipes the session's tumblr.com cookies to
 * `gh` on stdin, so they are never printed. Run it again when an upload in CI
 * fails because the session has expired.
 */

import { execFileSync } from "node:child_process";
import { withEditor } from "./tumblr-browser.mjs";

const cookies = await withEditor((_page, context) => context.cookies());
const session = cookies.filter(({ domain }) => domain.endsWith("tumblr.com"));

execFileSync("gh", ["-R", "precociouslydigital/skyedelaciel", "secret", "set", "TUMBLR_SESSION"], {
    input: JSON.stringify(session),
    stdio: ["pipe", "ignore", "inherit"],
});

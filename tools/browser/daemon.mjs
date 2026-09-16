// @ts-check
/**
 * The browser half of `tools/browse`.
 *
 * Every shell command runs in a fresh process, so an interactive browser REPL
 * cannot be held open across calls. Inverting that solves it: a daemon owns the
 * browser, and a stateless client sends it one command at a time. Scroll
 * position, toggled themes, expanded TOC nodes and the console buffer all
 * survive between calls, which is what makes this feel like a REPL instead of a
 * series of one-shot scripts that each pay a second of browser startup.
 *
 * One page per profile, opened on first use. Binding the socket is the
 * single-instance lock, so there is no separate lockfile to disagree with it.
 */

import { createServer } from "node:net";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { logPath, pidfilePath, socketPath, sourceHash } from "./profiles.mjs";
import { isUp, openProfilePage, resolveBaseUrl } from "./context.mjs";

/** @typedef {import("./profiles.mjs").ProfileName} ProfileName */
/** @typedef {import("./profiles.mjs").Request} Request */

/** How long without a command before the daemon reaps itself. */
const IDLE_MS = Number(process.env.BROWSE_IDLE_MS ?? 10 * 60 * 1000);

/** Console, error and network buffers keep this many of the most recent entries. */
const BUFFER_LIMIT = 500;

const EXPECTED_HASH = sourceHash();

/** Raised for anything the user can fix by retyping the command. */
class UsageError extends Error {}

// ─── Browser and per-profile sessions ────────────────────────────────────────

/** @typedef {{ at: string, [key: string]: unknown }} Entry */

/**
 * @typedef {object} Session
 * @property {import("playwright").BrowserContext} context
 * @property {import("playwright").Page} page
 * @property {number} scale     deviceScaleFactor this context was built with
 * @property {Entry[]} console
 * @property {Entry[]} errors
 * @property {Entry[]} net
 */

/** @type {import("playwright").BrowserServer} */
let browserServer;
/** @type {import("playwright").Browser} */
let browser;

/** @type {Map<ProfileName, Session>} */
const sessions = new Map();

/**
 * Append to a buffer, dropping the oldest entries once it is full.
 * @param {Entry[]} buffer
 * @param {Record<string, unknown>} entry
 */
function record(buffer, entry) {
    buffer.push({ at: new Date().toISOString(), ...entry });
    if (buffer.length > BUFFER_LIMIT) buffer.shift();
}

/** Attach the listeners that fill a session's buffers. */
function observe(/** @type {Session} */ session) {
    const { page } = session;
    page.on("console", (message) =>
        record(session.console, {
            type: message.type(),
            text: message.text(),
            url: page.url(),
        }),
    );
    page.on("pageerror", (error) =>
        record(session.errors, {
            message: error.message,
            stack: error.stack,
            url: page.url(),
        }),
    );
    page.on("response", (response) =>
        record(session.net, {
            method: response.request().method(),
            status: response.status(),
            url: response.url(),
        }),
    );
    page.on("requestfailed", (request) =>
        record(session.net, {
            method: request.method(),
            status: "failed",
            url: request.url(),
            failure: request.failure()?.errorText,
        }),
    );
}

/** The live session for a profile, opening it on first use. */
async function session(/** @type {ProfileName} */ name) {
    const existing = sessions.get(name);
    if (existing) return existing;

    const fresh = {
        ...(await openProfilePage(browser, name, 1)),
        console: [],
        errors: [],
        net: [],
    };
    observe(fresh);
    sessions.set(name, fresh);
    return fresh;
}

/**
 * Swap in a new context for an existing session, keeping the session object —
 * and so its buffers — in place. Returns to whatever page was open, since
 * losing the current URL on a rescale would defeat the point of the daemon.
 *
 * @param {ProfileName} name
 * @param {Session} current
 * @param {number} scale
 */
async function rebuild(name, current, scale) {
    const url = current.page.url();
    await current.context.close();
    Object.assign(current, await openProfilePage(browser, name, scale));
    observe(current);
    if (url && url !== "about:blank") await current.page.goto(url);
}

// ─── Where the site is being served ──────────────────────────────────────────

/** @type {string | undefined} */
let cachedBase;

/**
 * The origin to resolve relative paths against. Re-probed whenever the cached
 * one stops answering, so restarting the dev server does not also mean
 * restarting the daemon.
 *
 * @param {string | undefined} override  $BROWSE_BASE, as the client saw it
 */
async function baseUrl(override) {
    if (!override && cachedBase && (await isUp(cachedBase))) return cachedBase;
    cachedBase = await resolveBaseUrl(override);
    return cachedBase;
}

// ─── Argument parsing ────────────────────────────────────────────────────────

/**
 * Short forms, expanded before a flag is looked up in a command's spec.
 * @type {Record<string, string>}
 */
const ALIASES = { o: "out", s: "sel" };

/**
 * Parse argv against a command's declared flags. An undeclared flag is an error
 * rather than a silently ignored typo — the whole point of declaring them.
 *
 * @param {string[]} argv
 * @param {Record<string, "string" | "number" | "boolean">} spec
 */
function parseArgs(argv, spec) {
    /** @type {Record<string, string | number | boolean>} */
    const flags = {};
    /** @type {string[]} */
    const positionals = [];

    for (let i = 0; i < argv.length; i++) {
        const token = argv[i] ?? "";
        if (token === "--") {
            positionals.push(...argv.slice(i + 1));
            break;
        }
        if (!token.startsWith("-") || token === "-") {
            positionals.push(token);
            continue;
        }

        const bare = token.replace(/^--?/, "");
        const name = ALIASES[bare] ?? bare;
        const type = spec[name];
        if (!type) throw new UsageError(`unknown flag ${token}`);
        if (type === "boolean") {
            flags[name] = true;
            continue;
        }

        const value = argv[++i];
        if (value === undefined)
            throw new UsageError(`${token} expects a value`);
        flags[name] = type === "number" ? Number(value) : value;
    }

    return { flags, positionals };
}

/**
 * The one positional a selector-taking command needs.
 * @param {string[]} positionals
 * @param {string} usage
 */
function selector(positionals, usage) {
    const [first] = positionals;
    if (!first) throw new UsageError(`usage: ${usage}`);
    return first;
}

/**
 * Where a written file should land: an explicit `-o` resolved against the
 * client's working directory, or a stamped name under its output directory.
 * @param {{ flags: Record<string, unknown>, request: Request, profile: string }} ctx
 * @param {string} extension
 */
function outputPath(ctx, extension) {
    const { flags, request, profile } = ctx;
    const named = typeof flags.out === "string" ? flags.out : undefined;
    const target = named
        ? isAbsolute(named)
            ? named
            : resolve(request.cwd, named)
        : join(
              request.outDir,
              `${profile}-${Date.now().toString(36)}.${extension}`,
          );
    mkdirSync(dirname(target), { recursive: true });
    return target;
}

// ─── Commands ────────────────────────────────────────────────────────────────

/**
 * What every command handler is handed.
 *
 * @typedef {object} CommandContext
 * @property {Session} session      the page for the requested profile
 * @property {ProfileName} profile
 * @property {Record<string, any>} flags
 * @property {string[]} positionals
 * @property {Request} request
 */

/**
 * @typedef {object} Command
 * @property {string} usage
 * @property {string} summary
 * @property {Record<string, "string" | "number" | "boolean">} flags
 * @property {(ctx: CommandContext) => unknown} run
 */

/**
 * Buffers all read the same way, so they are declared the same way.
 * @param {"console" | "errors" | "net"} field
 * @param {string} summary
 * @returns {Command}
 */
const bufferCommand = (field, summary) => ({
    usage: `${field} [--clear]`,
    summary,
    flags: { clear: "boolean" },
    run: ({ session, flags }) => {
        const entries = [...session[field]];
        if (flags.clear) session[field].length = 0;
        return entries;
    },
});

/** @type {Record<string, Command>} */
const commands = {
    goto: {
        usage: "goto <path|url>",
        summary: "navigate; bare paths resolve against the running server",
        flags: {},
        run: async ({ session, positionals, request }) => {
            const [target = "/"] = positionals;
            const url = /^[a-z]+:\/\//.test(target)
                ? target
                : new URL(target, await baseUrl(request.base)).href;
            const response = await session.page.goto(url, {
                waitUntil: "load",
            });
            return {
                url: session.page.url(),
                status: response?.status() ?? null,
            };
        },
    },

    shot: {
        usage: "shot [--sel CSS] [--full] [--scale N] [-o FILE]",
        summary: "write a PNG and print its path",
        flags: {
            sel: "string",
            full: "boolean",
            scale: "number",
            out: "string",
        },
        run: async (ctx) => {
            const { session, flags, profile } = ctx;
            // deviceScaleFactor is fixed when a context is built, so asking for
            // a different one rebuilds it. Sticky until changed again.
            if (flags.scale !== undefined && flags.scale !== session.scale) {
                await rebuild(profile, session, flags.scale);
            }
            const path = outputPath(ctx, "png");
            const target = flags.sel
                ? session.page.locator(flags.sel).first()
                : session.page;
            await target.screenshot({
                path,
                ...(flags.full && !flags.sel && { fullPage: true }),
            });
            return path;
        },
    },

    pdf: {
        usage: "pdf [-o FILE]",
        summary: "render the page through Chromium's real print path",
        flags: { out: "string" },
        run: async (ctx) => {
            const path = outputPath(ctx, "pdf");
            await ctx.session.page.pdf({ path, printBackground: true });
            return path;
        },
    },

    box: {
        usage: "box <CSS>",
        summary: "bounding rectangles of every match",
        flags: {},
        run: async ({ session, positionals }) => {
            const css = selector(positionals, "box <CSS>");
            const matches = session.page.locator(css);
            const count = await matches.count();
            const boxes = [];
            for (let i = 0; i < count; i++) {
                boxes.push(await matches.nth(i).boundingBox());
            }
            return { selector: css, count, boxes };
        },
    },

    styles: {
        usage: "styles <CSS> <property...>",
        summary: "computed styles of every match",
        flags: {},
        run: async ({ session, positionals }) => {
            const [css, ...properties] = positionals;
            if (!css || properties.length === 0)
                throw new UsageError("usage: styles <CSS> <property...>");
            return session.page.locator(css).evaluateAll(
                (elements, wanted) =>
                    elements.map((element) => {
                        const computed = getComputedStyle(element);
                        return Object.fromEntries(
                            wanted.map((property) => [
                                property,
                                computed.getPropertyValue(property),
                            ]),
                        );
                    }),
                properties,
            );
        },
    },

    text: {
        usage: "text <CSS>",
        summary: "text content of every match",
        flags: {},
        run: ({ session, positionals }) =>
            session.page
                .locator(selector(positionals, "text <CSS>"))
                .allTextContents(),
    },

    html: {
        usage: "html <CSS>",
        summary: "outer HTML of every match",
        flags: {},
        run: ({ session, positionals }) =>
            session.page
                .locator(selector(positionals, "html <CSS>"))
                .evaluateAll((elements) =>
                    elements.map((element) => element.outerHTML),
                ),
    },

    eval: {
        usage: "eval <js>",
        summary: "evaluate an expression in the page",
        flags: {},
        run: ({ session, positionals }) => {
            if (positionals.length === 0)
                throw new UsageError("usage: eval <js>");
            return session.page.evaluate(positionals.join(" "));
        },
    },

    click: {
        usage: "click <CSS> [--nth N]",
        summary: "click a match (the first, unless --nth says otherwise)",
        flags: { nth: "number" },
        run: async ({ session, positionals, flags }) => {
            const css = selector(positionals, "click <CSS>");
            await session.page
                .locator(css)
                .nth(flags.nth ?? 0)
                .click();
            return { clicked: css, nth: flags.nth ?? 0 };
        },
    },

    hover: {
        usage: "hover <CSS> [--nth N]",
        summary: "hover a match — popovers, sidenote highlights, anchor icons",
        flags: { nth: "number" },
        run: async ({ session, positionals, flags }) => {
            const css = selector(positionals, "hover <CSS>");
            await session.page
                .locator(css)
                .nth(flags.nth ?? 0)
                .hover();
            return { hovered: css, nth: flags.nth ?? 0 };
        },
    },

    key: {
        usage: "key <KEY>",
        summary: "press a key, e.g. Enter or Shift+Tab",
        flags: {},
        run: async ({ session, positionals }) => {
            const key = selector(positionals, "key <KEY>");
            await session.page.keyboard.press(key);
            return { pressed: key };
        },
    },

    scroll: {
        usage: "scroll (--by PX | --to CSS)",
        summary: "scroll by a distance, or to an element",
        flags: { by: "number", to: "string" },
        run: async ({ session, flags }) => {
            if ((flags.by === undefined) === (flags.to === undefined))
                throw new UsageError("scroll takes exactly one of --by, --to");
            if (flags.to) {
                await session.page
                    .locator(flags.to)
                    .first()
                    .scrollIntoViewIfNeeded();
            } else {
                await session.page.evaluate(
                    (by) => window.scrollBy(0, by),
                    flags.by,
                );
            }
            return session.page.evaluate(() => ({
                scrollY: window.scrollY,
                scrollX: window.scrollX,
            }));
        },
    },

    media: {
        usage: "media [--type screen|print] [--scheme light|dark]",
        summary: "re-emulate media for this page, for eyeballing the themes",
        flags: { type: "string", scheme: "string" },
        run: async ({ session, flags }) => {
            await session.page.emulateMedia({
                ...(flags.type && { media: flags.type }),
                ...(flags.scheme && { colorScheme: flags.scheme }),
            });
            return { type: flags.type, scheme: flags.scheme };
        },
    },

    a11y: {
        usage: "a11y [CSS]",
        summary: "axe-core violations, worst impact first",
        flags: {},
        run: async ({ session, positionals }) => {
            const builder = new AxeBuilder({ page: session.page });
            if (positionals[0]) builder.include(positionals[0]);
            const { violations } = await builder.analyze();
            const order = ["critical", "serious", "moderate", "minor"];
            return violations
                .map((violation) => ({
                    id: violation.id,
                    impact: violation.impact,
                    help: violation.help,
                    nodes: violation.nodes.map((node) => ({
                        target: node.target,
                        summary: node.failureSummary,
                    })),
                }))
                .sort(
                    (a, b) =>
                        order.indexOf(a.impact ?? "minor") -
                        order.indexOf(b.impact ?? "minor"),
                );
        },
    },

    console: bufferCommand("console", "buffered console messages"),
    errors: bufferCommand("errors", "buffered uncaught page errors"),
    net: bufferCommand("net", "buffered responses and failed requests"),

    reset: {
        usage: "reset",
        summary: "discard this profile's page, buffers and all",
        flags: {},
        run: async ({ session, profile }) => {
            await session.context.close();
            sessions.delete(profile);
            return { reset: profile };
        },
    },

    status: {
        usage: "status",
        summary: "what the daemon is holding open",
        flags: {},
        run: async () => ({
            pid: process.pid,
            idleMs: IDLE_MS,
            base: cachedBase ?? null,
            open: [...sessions].map(([name, open]) => ({
                profile: name,
                url: open.page.url(),
                scale: open.scale,
            })),
        }),
    },

    stop: {
        usage: "stop",
        summary: "close the browser and exit",
        flags: { force: "boolean" },
        run: async () => ({ stopped: true, pid: process.pid }),
    },

    help: {
        usage: "help",
        summary: "list commands",
        flags: {},
        run: async () =>
            Object.entries(commands).map(([name, command]) => ({
                command: name,
                usage: command.usage,
                summary: command.summary,
            })),
    },
};

// ─── Request handling ────────────────────────────────────────────────────────

let lastCommandAt = Date.now();

/** @param {Request} request */
async function dispatch(request) {
    const [name, ...argv] = request.argv;
    const command = name ? commands[name] : undefined;
    if (!command) {
        throw new UsageError(
            `unknown command ${name ?? "(none)"} — try \`browse help\``,
        );
    }

    const { flags, positionals } = parseArgs(argv, command.flags);
    return command.run({
        session: await session(request.profile),
        profile: request.profile,
        flags,
        positionals,
        request,
    });
}

/**
 * Answer one command, and say whether answering it was the daemon's last act.
 * @param {string} line
 */
async function handle(line) {
    lastCommandAt = Date.now();

    /** @type {Request} */
    const request = JSON.parse(line);

    // A daemon serves the tables it started with. Rather than quietly answering
    // out of an edited-away profile list, it stands down so the client can
    // start a successor.
    if (request.hash !== EXPECTED_HASH) {
        return {
            reply: { ok: false, code: "STALE", error: "daemon source changed" },
            thenExit: true,
        };
    }

    try {
        return {
            reply: { ok: true, result: await dispatch(request) },
            thenExit: request.argv[0] === "stop",
        };
    } catch (error) {
        return {
            reply: {
                ok: false,
                code: error instanceof UsageError ? "USAGE" : "FAILED",
                error: error instanceof Error ? error.message : String(error),
            },
            thenExit: false,
        };
    }
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

let shuttingDown = false;

/** @param {number} code */
async function shutdown(code) {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
        server.close();
    } catch {}
    try {
        await browserServer?.close();
    } catch {}
    for (const path of [socketPath, pidfilePath]) {
        try {
            unlinkSync(path);
        } catch {}
    }
    process.exit(code);
}

const server = createServer((socket) => {
    let buffer = "";
    let answered = false;

    socket.on("data", async (chunk) => {
        if (answered) return;
        buffer += chunk;
        if (!buffer.includes("\n")) return;
        answered = true;

        const { reply, thenExit } = await handle(
            buffer.slice(0, buffer.indexOf("\n")),
        );
        socket.end(JSON.stringify(reply) + "\n", () => {
            if (thenExit) shutdown(0);
        });
    });

    socket.on("error", () => {});
});

server.on("error", (error) => {
    // Another daemon won the race to bind. It can serve the client just as well.
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "EADDRINUSE")
        process.exit(0);
    console.error(error);
    process.exit(1);
});

for (const signal of /** @type {const} */ (["SIGTERM", "SIGINT"])) {
    process.on(signal, () => shutdown(0));
}

// Compared against a timestamp rather than armed as a one-shot timer, so a
// laptop that sleeps through the idle window still reaps the daemon on wake.
setInterval(() => {
    if (Date.now() - lastCommandAt > IDLE_MS) shutdown(0);
}, 30_000);

browserServer = await chromium.launchServer({ headless: true });
browser = await chromium.connect(browserServer.wsEndpoint());
writeFileSync(
    pidfilePath,
    JSON.stringify({
        daemon: process.pid,
        chromium: browserServer.process()?.pid ?? null,
        log: logPath,
    }),
);
server.listen(socketPath);

#!/usr/bin/env node
// @ts-check
/**
 * A headless browser you can drive from the shell one command at a time.
 *
 *   tools/browse [--profile wide|narrow|print|nojs] <command> [args]
 *
 * This half is stateless: it connects to the daemon that actually holds the
 * browser, sends one JSON line, prints one JSON line and exits. The daemon is
 * started on demand, so "the daemon isn't running" is never a state you have to
 * think about. See daemon.mjs for the other half, and
 * breadcrumbs/tools/browse.md for why it is shaped this way.
 */

import { spawn } from "node:child_process";
import { existsSync, openSync, readFileSync, unlinkSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    defaultProfile,
    logPath,
    pidfilePath,
    profileNames,
    profiles,
    repoRoot,
    socketPath,
    sourceHash,
} from "./profiles.mjs";

const DAEMON = fileURLToPath(new URL("./daemon.mjs", import.meta.url));

/** @typedef {import("./profiles.mjs").Request} Request */
/** @typedef {import("./profiles.mjs").Reply} Reply */

// ─── Talking to the daemon ───────────────────────────────────────────────────

/**
 * One request, one reply. Rejects with the connect error if nothing listens.
 * @param {Request} request
 * @returns {Promise<Reply>}
 */
function exchange(request) {
    return new Promise((resolve, reject) => {
        const socket = connect(socketPath);
        let buffer = "";
        socket.on("connect", () =>
            socket.write(JSON.stringify(request) + "\n"),
        );
        socket.on("data", (chunk) => (buffer += chunk));
        socket.on("end", () => {
            try {
                resolve(JSON.parse(buffer));
            } catch {
                reject(new Error(`unreadable reply: ${buffer.slice(0, 200)}`));
            }
        });
        socket.on("error", reject);
    });
}

const discard = (/** @type {() => void} */ action) => {
    try {
        action();
    } catch {}
};

/**
 * Send once, returning null when no daemon answered.
 *
 * Unclean death is the case this is shaped around: a SIGKILLed daemon leaves
 * its socket file on disk, so the file existing proves nothing. Only a refused
 * connection distinguishes "gone" from "never started", and it is also the
 * moment we know the leftover file is safe to remove.
 *
 * @param {Request} request
 * @returns {Promise<Reply | null>}
 */
async function attempt(request) {
    try {
        return await exchange(request);
    } catch (error) {
        const { code } = /** @type {NodeJS.ErrnoException} */ (error);
        if (code === "ECONNREFUSED") discard(() => unlinkSync(socketPath));
        else if (code !== "ENOENT") throw error;
        return null;
    }
}

const sleep = (/** @type {number} */ ms) =>
    new Promise((done) => setTimeout(done, ms));

/**
 * Poll until `ready()` holds, or give up.
 * @param {() => Promise<boolean>} ready
 * @param {number} timeoutMs
 */
async function waitFor(ready, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await ready()) return true;
        await sleep(100);
    }
    return false;
}

async function startDaemon() {
    const log = openSync(logPath, "a");
    spawn(process.execPath, [DAEMON], {
        detached: true,
        stdio: ["ignore", log, log],
        cwd: repoRoot,
    }).unref();

    const listening = await waitFor(async () => {
        const socket = connect(socketPath);
        return new Promise((resolve) => {
            socket.on("connect", () => (socket.destroy(), resolve(true)));
            socket.on("error", () => resolve(false));
        });
    }, 30_000);

    if (!listening) {
        const tail = existsSync(logPath)
            ? readFileSync(logPath, "utf8").split("\n").slice(-15).join("\n")
            : "(no log)";
        throw new Error(`daemon did not come up.\n${tail}`);
    }
}

/**
 * Send a command, starting or replacing the daemon as needed.
 * @param {Request} request
 * @returns {Promise<Reply>}
 */
async function send(request) {
    for (let tries = 0; tries < 3; tries++) {
        const reply = await attempt(request);
        if (reply && reply.code !== "STALE") return reply;
        // STALE: the daemon read its own source as out of date and is exiting.
        if (reply) await waitFor(async () => !existsSync(socketPath), 5_000);
        await startDaemon();
    }
    throw new Error(`daemon kept standing down; see ${logPath}`);
}

// ─── stop ────────────────────────────────────────────────────────────────────

/** Kill whatever the pidfile still names — a chromium that outlived its daemon. */
function reap() {
    /** @type {Record<string, unknown>} */
    let pids;
    try {
        pids = JSON.parse(readFileSync(pidfilePath, "utf8"));
    } catch {
        return [];
    }

    const killed = [];
    for (const [role, pid] of Object.entries(pids)) {
        if (typeof pid !== "number") continue;
        try {
            process.kill(pid, "SIGKILL");
            killed.push({ role, pid });
        } catch {}
    }
    for (const path of [socketPath, pidfilePath])
        discard(() => unlinkSync(path));
    return killed;
}

/**
 * Shutting down never starts a daemon first.
 * @param {Request} request
 * @param {boolean} force
 * @returns {Promise<Reply>}
 */
async function stop(request, force) {
    const reply = await attempt(request);
    const result = /** @type {Record<string, unknown>} */ (
        reply?.ok
            ? reply.result
            : { stopped: false, reason: "no daemon was running" }
    );
    return { ok: true, result: force ? { ...result, reaped: reap() } : result };
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const USAGE = `usage: tools/browse [--profile NAME] <command> [args]

profiles:
${profileNames
    .map((name) => `  ${name.padEnd(8)} ${profiles[name].checks}`)
    .join("\n")}

Run \`tools/browse help\` for the command list.`;

/** @param {string[]} argv */
async function main(argv) {
    let profile = defaultProfile;
    while (argv[0] === "--profile" || argv[0] === "-p") {
        const [, name] = argv.splice(0, 2);
        if (!profileNames.includes(/** @type {any} */ (name))) {
            throw new Error(
                `unknown profile ${name} — one of ${profileNames.join(", ")}`,
            );
        }
        profile = /** @type {any} */ (name);
    }

    if (argv.length === 0) {
        process.stdout.write(USAGE + "\n");
        return;
    }

    const request = {
        hash: sourceHash(),
        profile,
        cwd: process.cwd(),
        outDir: process.env.BROWSE_OUT ?? join(tmpdir(), "browse"),
        base: process.env.BROWSE_BASE,
        argv,
    };

    const reply =
        argv[0] === "stop"
            ? await stop(request, argv.includes("--force"))
            : await send(request);

    if (!reply.ok) {
        process.stderr.write(`browse: ${reply.error}\n`);
        process.exit(1);
    }

    const { result } = reply;
    process.stdout.write(
        (typeof result === "string"
            ? result
            : JSON.stringify(result, null, 2)) + "\n",
    );
}

// Piping into `head` or `grep -q` closes stdout early; that is the reader's
// decision, not an error this tool should die on.
process.stdout.on("error", (error) => {
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== "EPIPE")
        throw error;
});

main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`browse: ${error.message}\n`);
    process.exit(1);
});

#!/usr/bin/env node
/**
 * Reclaims the dev-server port before Vite starts.
 *
 * WHY THIS EXISTS
 *
 * Both dev modes must live on port 5173, and neither one gets to move:
 *
 *   - `npm run dev` needs 5173 because the OAuth redirect URI is chosen by the
 *     SERVER, not the browser. Django derives it from FRONTEND_URL as
 *     "http://localhost:5173/auth/callback" (settings.py), and that exact
 *     string is what's registered in the Google and Discord consoles. A dev
 *     server on any other port can start a sign-in but can never receive the
 *     callback -- Google bounces the browser to 5173 regardless.
 *
 *   - `npm run dev:live` needs 5173 because the PRODUCTION API's CORS allowlist
 *     is "http://localhost:5173" and nothing else. Port 5174 gets a CORS
 *     rejection from the live backend.
 *
 * So the port is a single, non-negotiable slot -- and Vite's default behaviour
 * is to quietly slide to 5174 when it's occupied, printing one grey line. That
 * silent drift is the bug this guards. A drifted server looks completely normal
 * until you click "Continue with Google", at which point the provider returns
 * the browser to whatever is sitting on 5173 -- possibly a totally different
 * server, in a different mode, pointed at a different database.
 *
 * WHAT IT DOES
 *
 * If a stale Vite belonging to THIS project is squatting on the port, kill it
 * and say so. Anything else -- some unrelated program -- is reported and left
 * alone, because silently killing a process we don't recognise is worse than
 * refusing to start.
 *
 * Usage:  node scripts/dev-preflight.mjs <port> [--stop-only]
 */

import { execSync } from "node:child_process"
import { readFileSync, readlinkSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const port = Number(process.argv[2])
const stopOnly = process.argv.includes("--stop-only")
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

if (!Number.isInteger(port) || port <= 0) {
	console.error("dev-preflight: expected a port number as the first argument")
	process.exit(1)
}

/** PIDs currently LISTENing on `port`, via ss(8). Empty if none or if ss fails. */
function listenerPids() {
	let out = ""
	try {
		// -H would drop the header, but it isn't in every iproute2 build, so we
		// filter on the LISTEN prefix instead and stay portable.
		out = execSync(`ss -tlnp 2>/dev/null`, { encoding: "utf8" })
	} catch {
		return []
	}

	const pids = new Set()
	for (const line of out.split("\n")) {
		if (!line.startsWith("LISTEN")) continue
		// Columns: State Recv-Q Send-Q Local:Port Peer:Port [Process]
		const localAddr = line.trim().split(/\s+/)[3] ?? ""
		// Matches "127.0.0.1:5173", "0.0.0.0:5173" and "[::1]:5173" alike, while
		// refusing to match a port that merely ends in the same digits.
		if (!localAddr.endsWith(`:${port}`)) continue
		for (const m of line.matchAll(/pid=(\d+)/g)) pids.add(Number(m[1]))
	}
	return [...pids]
}

/** Reads /proc to work out what a PID actually is. Null if it's already gone. */
function inspect(pid) {
	try {
		return {
			pid,
			cwd: readlinkSync(`/proc/${pid}/cwd`),
			// /proc cmdline is NUL-separated, not space-separated.
			argv: readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").filter(Boolean),
		}
	} catch {
		return null
	}
}

/**
 * Is this one of OUR dev servers?
 *
 * Deliberately strict: it must be a Vite launched from this checkout. We test
 * the resolved binary path as well as the cwd, because npm scripts inherit the
 * package directory as cwd but a process started elsewhere might not.
 */
function isOwnViteServer(proc) {
	const joined = proc.argv.join(" ")
	const looksLikeVite = /(^|[/\s])vite(\s|$|\.js|\.mjs)/.test(joined)
	const belongsToUs = proc.cwd === projectRoot || joined.includes(projectRoot)
	return looksLikeVite && belongsToUs
}

/** "dev:live" or "dev" -- whichever npm script this process came from. */
function modeOf(proc) {
	const argv = proc.argv
	const i = argv.indexOf("--mode")
	return i !== -1 && argv[i + 1] === "live" ? "npm run dev:live" : "npm run dev"
}

/** Busy-wait (without async plumbing) until the port frees up or we time out. */
function waitForPortRelease(timeoutMs) {
	const deadline = Date.now() + timeoutMs
	while (Date.now() < deadline) {
		if (listenerPids().length === 0) return true
		// execSync on ss already costs a few ms; this keeps the loop from spinning.
		try {
			execSync("sleep 0.1")
		} catch {
			/* ignore */
		}
	}
	return listenerPids().length === 0
}

const pids = listenerPids()

if (pids.length === 0) {
	if (stopOnly) console.log(`[dev] nothing is listening on port ${port}.`)
	process.exit(0)
}

const holders = pids.map(inspect).filter(Boolean)
const ours = holders.filter(isOwnViteServer)
const foreign = holders.filter((p) => !isOwnViteServer(p))

// Something we don't recognise owns the port. Refuse rather than guess.
if (ours.length === 0) {
	console.error(`\n[dev] Port ${port} is in use by a process this script does not recognise:\n`)
	for (const p of foreign) {
		console.error(`        pid ${p.pid}  ${p.argv.slice(0, 4).join(" ")}`)
		console.error(`        cwd ${p.cwd}\n`)
	}
	console.error(`      Not killing it. Free the port yourself, then retry.\n`)
	process.exit(1)
}

for (const p of ours) {
	console.log(`[dev] Reclaiming port ${port} from a stale dev server (pid ${p.pid}, ${modeOf(p)}).`)
	try {
		// SIGTERM first so Vite can close its watchers and sockets cleanly.
		process.kill(p.pid, "SIGTERM")
	} catch {
		/* Already exited between the scan and now. */
	}
}

if (!waitForPortRelease(3000)) {
	for (const p of ours) {
		try {
			process.kill(p.pid, "SIGKILL")
		} catch {
			/* ignore */
		}
	}
	waitForPortRelease(2000)
}

if (listenerPids().length > 0) {
	console.error(`[dev] Port ${port} is still held after SIGKILL. Investigate manually.`)
	process.exit(1)
}

console.log(`[dev] Port ${port} is free.`)

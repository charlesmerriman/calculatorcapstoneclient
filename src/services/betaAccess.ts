/**
 * Closed-beta passcode gate.
 *
 * A single shared passcode unlocks /app during the Patreon closed beta. This is
 * deliberately a SOFT gate: the Django API stays public, so it keeps casual
 * visitors out rather than defending against anyone determined. See BetaGate.tsx
 * for the UI and CLAUDE.md for how to switch it off at launch.
 *
 * Two design points that make it slightly better than a naive string compare:
 *
 *   1. What ships in the bundle is the SHA-256 HASH of the passcode, never the
 *      passcode. Nobody can grep the plaintext out of the JS, and the hash is
 *      safe to commit to .env.
 *   2. What we store in localStorage is that same hash. So the boot check is a
 *      plain synchronous string comparison (no async work before first paint,
 *      no flash of either the app or the gate), and rotating the passcode
 *      instantly invalidates every browser that had unlocked with the old one.
 *
 * Hashing is therefore async and happens ONLY on submit — never on load.
 */

const STORAGE_KEY = "betaAccess.v1"

/**
 * Thrown by sha256Hex when Web Crypto is missing. Exported so the UI can show a
 * message that names the actual cause instead of "wrong passcode".
 */
export const INSECURE_CONTEXT_ERROR = "beta-gate/insecure-context"

/**
 * The build-time hash, normalized the same way typed input is.
 *
 * Read inside a function rather than at module scope (the convention used by
 * API_URL in socialAuth.ts and friends) for two reasons: vi.stubEnv() can swap
 * it per-test, and Vite's build-time substitution is a plain textual replacement
 * of the `import.meta.env.X` expression, so it still inlines correctly here.
 *
 * The trim/lowercase matters in practice — a hash pasted into .env or the
 * DigitalOcean dashboard very easily picks up a trailing newline, and that would
 * otherwise silently reject every correct passcode.
 */
function configuredHash(): string {
	const value = import.meta.env.VITE_BETA_PASSCODE_HASH
	return typeof value === "string" ? value.trim().toLowerCase() : ""
}

/**
 * Whether the gate is switched on at all.
 *
 * No hash configured means no gate. This FAILS OPEN on purpose: a misconfigured
 * deploy locking every beta tester out with no recourse is a worse failure than
 * the site briefly being public, and it makes "end the beta" a one-variable
 * change with no code edit.
 */
export function isGateEnabled(): boolean {
	return configuredHash().length > 0
}

/**
 * Passcodes are compared case-insensitively and with surrounding whitespace
 * stripped — people paste them out of Discord, often with a trailing newline.
 *
 * scripts/hash-passcode.mjs applies this exact same normalization, which is the
 * whole reason that script exists: generating the hash by hand risks hashing a
 * differently-cased string than the app checks against, producing a passcode
 * that is simply never accepted.
 */
export function normalizePasscode(raw: string): string {
	return raw.trim().toLowerCase()
}

/** SHA-256 of `text` as lowercase hex. */
export async function sha256Hex(text: string): Promise<string> {
	const subtle = globalThis.crypto?.subtle
	if (!subtle) {
		// crypto.subtle only exists in a secure context (HTTPS or localhost).
		// Production is HTTPS and dev is localhost, so the only realistic way to
		// land here is testing over a plain-http LAN address (e.g. from a phone).
		// Fail CLOSED and name the cause rather than quietly letting everyone in.
		throw new Error(INSECURE_CONTEXT_ERROR)
	}
	const digest = await subtle.digest("SHA-256", new TextEncoder().encode(text))
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("")
}

/**
 * localStorage access is wrapped because it throws outright in some
 * private-browsing modes. The repo already applies this reasoning to
 * sessionStorage (socialAuth.ts, guestMigration.ts); an unhandled throw here
 * would crash the gate screen itself, leaving the user with no way forward.
 */
function readStoredGrant(): string | null {
	try {
		return localStorage.getItem(STORAGE_KEY)
	} catch {
		return null
	}
}

/**
 * Whether this browser has already unlocked with the CURRENT passcode.
 *
 * Synchronous, so BetaGate can decide what to render in its initial state
 * without an effect. No shape validation is needed: a stale, truncated or
 * hand-forged value simply isn't equal to the configured hash, and the gate
 * stays shut. Returns false when the gate is disabled — callers check
 * isGateEnabled() first, and false is the safe answer either way.
 */
export function hasValidGrant(): boolean {
	const configured = configuredHash()
	if (!configured) return false
	return readStoredGrant() === configured
}

/**
 * Check a typed passcode and, if it matches, remember it for next time.
 *
 * Returns false rather than throwing on a wrong passcode; a thrown error here
 * means something structural (see INSECURE_CONTEXT_ERROR).
 */
export async function verifyPasscode(raw: string): Promise<boolean> {
	const hash = await sha256Hex(normalizePasscode(raw))
	if (hash !== configuredHash()) return false

	try {
		localStorage.setItem(STORAGE_KEY, hash)
	} catch {
		// Storage blocked. The unlock still stands for this page load — the user
		// just gets asked again on their next visit.
	}
	return true
}

/** Re-locks this browser. Used by the manual test pass, and handy from the console. */
export function clearGrant(): void {
	try {
		localStorage.removeItem(STORAGE_KEY)
	} catch {
		// Nothing to clean up if storage is unavailable.
	}
}

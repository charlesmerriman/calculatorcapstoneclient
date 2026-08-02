/**
 * Prints the SHA-256 hash of a closed-beta passcode, for VITE_BETA_PASSCODE_HASH.
 *
 *   npm run hash-passcode -- 'YourPasscode'
 *
 * This script exists so the hash can't drift from what the app actually checks.
 * It applies the SAME normalization as normalizePasscode() in
 * src/services/betaAccess.ts — hashing by hand and getting the case or a stray
 * space wrong yields a passcode that is silently never accepted, with no error
 * message pointing at the cause.
 */
import { createHash } from "node:crypto"

const raw = process.argv[2]

if (!raw) {
	console.error("Usage: npm run hash-passcode -- 'YourPasscode'")
	process.exit(1)
}

// Keep in sync with normalizePasscode() in src/services/betaAccess.ts.
const normalized = raw.trim().toLowerCase()

if (!normalized) {
	console.error("That passcode is empty once trimmed.")
	process.exit(1)
}

const hash = createHash("sha256").update(normalized, "utf8").digest("hex")

console.log(`
Passcode (normalized) : ${normalized}
  ^ this is what you give people — it is checked case-insensitively

Set this in frontend/.env for local dev, and on the DigitalOcean *frontend*
component (build-time) for production. Do not put it in .env.production —
keeping it out of the repo is what makes ending the beta a dashboard change.

VITE_BETA_PASSCODE_HASH=${hash}
`)

import { useState } from "react"
import type React from "react"
import type { ReactNode } from "react"
import { Footer } from "../footer/Footer"
import { Wordmark } from "../Wordmark"
import {
	INSECURE_CONTEXT_ERROR,
	hasValidGrant,
	isGateEnabled,
	verifyPasscode
} from "../../services/betaAccess"

/**
 * Closed-beta passcode wall for /app.
 *
 * Renders `children` untouched when the gate is switched off (no
 * VITE_BETA_PASSCODE_HASH configured) or when this browser has already unlocked
 * with the current passcode. Otherwise it shows the passcode form instead.
 *
 * Wrapping the route element rather than restructuring the route is deliberate:
 * removing this whole feature after the beta is deleting one wrapper and one
 * import. See CLAUDE.md → "Closed-beta passcode gate".
 *
 * Worth being explicit: this is a soft gate. The API is public, so it is a
 * doorman, not a lock.
 */
export const BetaGate: React.FC<{ children: ReactNode }> = ({ children }) => {
	/**
	 * Lazy initializer, mirroring ThemeProvider: a pure synchronous localStorage
	 * read, so the right UI is chosen before the first paint with no flash of
	 * either the app or the form. It compares two hashes — no hashing happens
	 * here, which is what keeps it synchronous. Safe under StrictMode's double
	 * invoke because there is no side effect to repeat.
	 */
	const [unlocked, setUnlocked] = useState<boolean>(
		() => !isGateEnabled() || hasValidGrant()
	)
	const [passcode, setPasscode] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [checking, setChecking] = useState(false)

	const handleSubmit = async (event: React.FormEvent): Promise<void> => {
		event.preventDefault()
		setError(null)
		setChecking(true)
		try {
			if (await verifyPasscode(passcode)) {
				setUnlocked(true)
				return
			}
			setError("That passcode isn't right. Check for typos and try again.")
		} catch (e: unknown) {
			// Only structural failures land here — a wrong passcode returns false.
			setError(
				e instanceof Error && e.message === INSECURE_CONTEXT_ERROR
					? "Your browser can't check the passcode over an insecure connection. Open this page over https."
					: "Something went wrong checking that passcode. Please try again."
			)
		} finally {
			setChecking(false)
		}
	}

	if (unlocked) return <>{children}</>

	return (
		<div className="flex min-h-screen flex-col bg-gray-900 p-4">
			<div className="m-auto w-full max-w-sm overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 shadow-2xl">
				{/* Brand header strip — same treatment as the sign-in card */}
				<div className="flex justify-center border-b border-gray-700 px-8 py-4">
					<Wordmark size="card" />
				</div>

				<div className="px-8 py-7">
					<h2 className="mb-2 text-xl font-semibold text-gray-100">Closed beta</h2>
					<p className="mb-6 text-sm text-gray-400">
						Enter your passcode to continue.
					</p>

					{error && (
						<div
							role="alert"
							className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5"
						>
							<p className="text-sm text-red-400">{error}</p>
						</div>
					)}

					<form onSubmit={(e) => void handleSubmit(e)}>
						<label
							htmlFor="beta-passcode"
							className="mb-2 block text-sm font-medium text-gray-300"
						>
							Passcode
						</label>
						{/* Plain text rather than a password field: it's a shared code,
						    not a personal secret, and letting people see what they typed
						    cuts down on "it says it's wrong" support. Case and stray
						    whitespace are normalized away in betaAccess.ts anyway. */}
						<input
							id="beta-passcode"
							type="text"
							value={passcode}
							onChange={(e) => setPasscode(e.target.value)}
							disabled={checking}
							autoComplete="off"
							autoCapitalize="none"
							autoCorrect="off"
							spellCheck={false}
							className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2.5 text-sm text-gray-100 outline-none transition focus:border-brand disabled:opacity-50"
						/>

						<button
							type="submit"
							disabled={checking || passcode.trim() === ""}
							className="mt-4 w-full cursor-pointer rounded-lg bg-brand py-2.5 text-sm font-bold text-black transition hover:bg-brand/85 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{checking ? "Checking…" : "Unlock"}
						</button>
					</form>
				</div>
			</div>
			<Footer />
		</div>
	)
}

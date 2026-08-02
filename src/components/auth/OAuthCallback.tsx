import { useEffect, useRef, useState } from "react"
import type React from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Footer } from "../footer/Footer"
import { Wordmark } from "../Wordmark"
import { completeSocialLogin } from "../../services/socialAuth"
import { ApiError } from "../../services/userServices"

/**
 * Where the provider sends the browser back to: /auth/callback?code=…&state=…
 *
 * Trades the one-time code for an API token, then hands off to /app, where
 * CalculatorProvider picks up any stashed guest plan exactly as it did after
 * the old password login.
 */
export const OAuthCallback: React.FC = () => {
	const [searchParams] = useSearchParams()
	const navigate = useNavigate()
	const [exchangeError, setExchangeError] = useState<string | null>(null)

	const code = searchParams.get("code")
	const state = searchParams.get("state")
	const providerError = searchParams.get("error")

	// Problems visible straight from the URL are derived during render rather
	// than pushed into state from an effect — they're a pure function of the
	// query string, so an effect would only add a wasted render pass.
	let paramError: string | null = null
	if (providerError) {
		// The user pressed Cancel on the consent screen. Not a failure worth
		// alarming language — just send them back to try again.
		paramError =
			providerError === "access_denied"
				? "Sign in was cancelled."
				: "Your provider reported a problem with the sign-in."
	} else if (!code || !state) {
		paramError = "This sign-in link is incomplete. Please try again."
	}

	const error = paramError ?? exchangeError

	/**
	 * The authorization code is SINGLE-USE. React StrictMode mounts every
	 * component twice in development, and without this guard the second mount
	 * would replay an already-redeemed code, get a 400, and show an error to a
	 * user whose sign-in actually succeeded. Same pattern as didMigrateRef in
	 * CalculatorProvider.
	 */
	const didExchangeRef = useRef(false)

	useEffect(() => {
		if (paramError || !code || !state) return
		if (didExchangeRef.current) return
		didExchangeRef.current = true

		// The provider is inferred from the pending login saved before the
		// redirect, not from the URL — the URL is attacker-controllable.
		let provider = ""
		try {
			const pendingRaw = sessionStorage.getItem("oauthState.v1")
			provider = (JSON.parse(pendingRaw ?? "{}") as { provider?: string }).provider ?? ""
		} catch {
			provider = ""
		}

		completeSocialLogin(provider, code, state)
			.then(() => {
				// replace: true so Back doesn't return to a spent callback URL.
				navigate("/app", { replace: true })
			})
			.catch((e: unknown) => {
				setExchangeError(
					e instanceof ApiError
						? e.message
						: "Could not complete sign in. Please try again."
				)
			})
	}, [code, state, paramError, navigate])

	return (
		<div className="flex min-h-screen flex-col bg-gray-900 p-4">
			<div className="m-auto w-full max-w-sm overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 shadow-2xl">
				<div className="flex justify-center border-b border-gray-700 px-8 py-4">
					<Wordmark size="card" />
				</div>

				<div className="px-8 py-7">
					{error ? (
						<>
							<h2 className="mb-3 text-xl font-semibold text-gray-100">Sign in failed</h2>
							<div role="alert" className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
								<p className="text-sm text-red-400">{error}</p>
							</div>
							<Link
								to="/login"
								className="block w-full rounded-lg bg-brand py-2.5 text-center text-sm font-bold text-black transition hover:bg-brand/85"
							>
								Back to sign in
							</Link>
							{/* Guests can keep planning without an account, so offer
							    the exit that doesn't require resolving the error. */}
							<Link
								to="/app"
								className="mt-4 block text-center text-xs text-gray-500 underline transition hover:text-gray-400"
							>
								Continue without an account
							</Link>
						</>
					) : (
						<div className="flex flex-col items-center gap-4 py-6" role="status" aria-live="polite">
							<div
								className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-brand"
								aria-hidden="true"
							/>
							<p className="text-sm text-gray-400">Signing you in…</p>
						</div>
					)}
				</div>
			</div>
			<Footer />
		</div>
	)
}

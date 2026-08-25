import type React from "react"
import { useState } from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { Send } from "lucide-react"
import { Navbar } from "../navbar/Navbar"
import { Footer } from "../footer/Footer"
import { feedbackSubmit } from "../../services/feedbackFetchCalls"
import { FEEDBACK_MESSAGE_MAX_LENGTH } from "../../types/feedback"
import type { FeedbackCategory } from "../../types/feedback"
import { useDocumentMeta } from "../../hooks/useDocumentMeta"

const CATEGORIES: { value: FeedbackCategory; label: string; hint: string }[] = [
	{ value: "bug", label: "Bug", hint: "Something is broken or behaving oddly." },
	{ value: "feature", label: "Feature idea", hint: "Something you wish the calculator did." },
	{ value: "data", label: "Data correction", hint: "A banner date, card or reward looks wrong." },
	{ value: "other", label: "Other", hint: "Anything else." },
]

// Warn while there is still room to edit rather than at the boundary, where the
// count only appears once the text has already been cut off.
const COUNTER_WARNING_THRESHOLD = FEEDBACK_MESSAGE_MAX_LENGTH - 200

/**
 * Public feedback form (route: /feedback).
 *
 * Works signed out — the API accepts guests and links a submission to an account
 * only when one happens to be signed in. Deliberately collects no contact
 * details: there is no reply address field, so this is one-way. See the
 * "Feedback you send us" section of the privacy policy.
 */
export const Feedback: React.FC = () => {
	useDocumentMeta("Feedback", "Report a bug, flag wrong banner data or suggest a feature for the Uma Musume Carat Calculator. No account needed.")

	const location = useLocation()
	const [category, setCategory] = useState<FeedbackCategory>("bug")
	const [message, setMessage] = useState("")
	// Honeypot. Bound to state only so React owns the input; a person never sees
	// it, so this should always be "" when the form is submitted by a human.
	const [website, setWebsite] = useState("")
	const [isSending, setIsSending] = useState(false)
	const [isSent, setIsSent] = useState(false)

	const trimmed = message.trim()
	const isEmpty = trimmed.length === 0
	const isOverLength = message.length > FEEDBACK_MESSAGE_MAX_LENGTH
	const canSubmit = !isEmpty && !isOverLength && !isSending

	const selectedHint = CATEGORIES.find((c) => c.value === category)?.hint

	const handleSubmit = async (event: React.FormEvent): Promise<void> => {
		event.preventDefault()
		if (!canSubmit) return

		setIsSending(true)
		try {
			const res = await feedbackSubmit({
				category,
				message: trimmed,
				source_path: location.pathname,
				website,
			})

			if (res.status === 429) {
				// Distinct from a generic failure: retrying immediately is exactly
				// the wrong response, so say so rather than inviting another click.
				toast.error("You've sent a few already. Please try again later.")
				return
			}
			if (!res.ok) throw new Error(`Feedback submit failed: ${res.status}`)

			setIsSent(true)
			toast.success("Thanks, your feedback has been sent.")
		} catch (err) {
			console.error(err)
			toast.error("Something went wrong sending that. Please try again.")
		} finally {
			setIsSending(false)
		}
	}

	return (
		// Same shell as PrivacyPolicy and Faq: flex-1 on <main> absorbs leftover
		// viewport height so the footer keeps its band at the bottom of a short page.
		<div className="flex min-h-dvh flex-col bg-gray-900">
			<Navbar />
			<main className="flex-1">
				<div className="mx-auto max-w-2xl px-4 py-8">
					<h1 className="text-3xl font-bold text-gray-100">Feedback</h1>
					<p className="mt-2 leading-relaxed text-gray-400">
						Found a bug, spotted wrong data, or thought of something the calculator should
						do? Send it here. You don&apos;t need an account.
					</p>

					{isSent ? (
						// Replaces the form rather than sitting above it: leaving a filled
						// form on screen after a successful send invites a double submission.
						<div className="mt-8 rounded-xl border border-gray-700 bg-gray-800 p-6 text-center shadow-md">
							<h2 className="text-lg font-semibold text-gray-100">Feedback sent</h2>
							<p className="mt-2 leading-relaxed text-gray-400">
								Thank you, it has been added to the queue. There&apos;s no reply address
								attached, so you won&apos;t hear back directly, but it will be read.
							</p>
							<button
								type="button"
								onClick={() => {
									setIsSent(false)
									setMessage("")
									setCategory("bug")
								}}
								className="mt-4 rounded-lg border border-gray-600 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:border-gray-400 hover:bg-gray-700 hover:text-gray-100"
							>
								Send another
							</button>
						</div>
					) : (
						<form onSubmit={handleSubmit} className="mt-8 space-y-6">
							<div>
								<label htmlFor="feedback-category" className="block text-sm font-semibold text-gray-200">
									What kind of feedback is this?
								</label>
								<select
									id="feedback-category"
									value={category}
									onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
									className="mt-2 w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-gray-100 transition focus:border-brand focus:outline-none"
								>
									{CATEGORIES.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
								{selectedHint && <p className="mt-1.5 text-xs text-gray-500">{selectedHint}</p>}
							</div>

							<div>
								<label htmlFor="feedback-message" className="block text-sm font-semibold text-gray-200">
									Your message
								</label>
								<textarea
									id="feedback-message"
									value={message}
									onChange={(e) => setMessage(e.target.value)}
									rows={9}
									required
									aria-describedby="feedback-message-help"
									placeholder="What happened, what you expected, and which screen you were on."
									className="mt-2 w-full resize-y rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 leading-relaxed text-gray-100 transition placeholder:text-gray-600 focus:border-brand focus:outline-none"
								/>
								<div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-2">
									<p id="feedback-message-help" className="text-xs text-gray-500">
										Please don&apos;t include personal details, as this is stored exactly as written.
									</p>
									{/* Only appears near the limit. A counter that is always visible
									    reads as a target to fill rather than a boundary to avoid. */}
									{message.length >= COUNTER_WARNING_THRESHOLD && (
										<span
											className={`text-xs tabular-nums ${isOverLength ? "text-red-400" : "text-gray-500"}`}
										>
											{message.length} / {FEEDBACK_MESSAGE_MAX_LENGTH}
										</span>
									)}
								</div>
							</div>

							{/* Honeypot. Hidden from sight, from the tab order, from screen readers
							    and from autocomplete, so no real person is ever offered it. A naive
							    bot fills every input it finds and gets its submission discarded —
							    silently, since the API answers 201 either way. */}
							<div className="hidden" aria-hidden="true">
								<label htmlFor="feedback-website">Leave this field empty</label>
								<input
									id="feedback-website"
									type="text"
									name="website"
									tabIndex={-1}
									autoComplete="off"
									value={website}
									onChange={(e) => setWebsite(e.target.value)}
								/>
							</div>

							<div className="flex items-center gap-3">
								<button
									type="submit"
									disabled={!canSubmit}
									className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2 font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
								>
									<Send className="h-4 w-4" aria-hidden="true" />
									{isSending ? "Sending…" : "Send feedback"}
								</button>
								{isOverLength && (
									<span className="text-sm text-red-400">
										That&apos;s too long to send. Please trim it.
									</span>
								)}
							</div>
						</form>
					)}
				</div>
			</main>
			<Footer />
		</div>
	)
}

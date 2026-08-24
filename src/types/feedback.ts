/**
 * Feedback form types.
 *
 * These mirror the POST /feedback request shape. There is no response type:
 * the endpoint is write-only and answers 201 with an empty body, so there is
 * nothing to model coming back.
 */

/** The kind of report being submitted. Must match FeedbackCategory on the API. */
export type FeedbackCategory = "bug" | "feature" | "data" | "other"

export interface FeedbackPayload {
	category: FeedbackCategory
	message: string
	/** Route the sender was on when they opened the form. Optional context. */
	source_path?: string
	/**
	 * Honeypot. Always submitted empty by the real form — the input is hidden
	 * from sight, skipped by tab order and excluded from autocomplete, so a
	 * person never fills it and a naive bot fills everything. A non-empty value
	 * makes the API discard the submission while still answering 201.
	 */
	website?: string
}

/** Mirrors MESSAGE_MAX_LENGTH on the API so the counter and the 400 agree. */
export const FEEDBACK_MESSAGE_MAX_LENGTH = 4000

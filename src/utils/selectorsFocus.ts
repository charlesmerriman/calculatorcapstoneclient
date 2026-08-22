/**
 * The deep-link contract between the Timeline and the Selectors page.
 *
 * A timeline banner that belongs to a paid campaign wears an
 * AnniversaryEventStrip, and that strip offers "Plan purchases" — the only
 * route from seeing a campaign to planning what you'd spend at it. The link has
 * to name WHICH campaign: the Selectors page lists every upcoming one, so
 * without a target it drops the reader at the top of a page of near-identical
 * cards and leaves them to find the one they just clicked.
 *
 * A plain `#hash` would nearly work here — unlike the Timeline, this page
 * renders every campaign at once with no windowing — but the browser only acts
 * on a hash for a document it is loading, not for a client-side route change,
 * so the element it names does not exist at the moment it would look. The page
 * has to resolve the target itself either way.
 *
 * Sibling of `utils/timelineFocus.ts`, deliberately NOT merged with it: that
 * one carries a `kind` prefix because the Timeline holds three sorts of target
 * and a bare id would be ambiguous between them. This page holds exactly one,
 * so a kind here would be ceremony that never discriminates anything.
 *
 * Lives in `utils/` because both ends of the link have to agree on the format,
 * and a timeline component must not reach into the selectors folder to build a
 * URL.
 */

/** The query parameter carrying the campaign's `AnniversaryEvent` id. */
export const SELECTORS_CAMPAIGN_PARAM = "campaign"

/** The Selectors route, so link builders don't repeat the path. */
const SELECTORS_PATH = "/app/selectors"

/** The `to` for a react-router `<Link>`. */
export function selectorsCampaignHref(eventId: number): string {
	return `${SELECTORS_PATH}?${SELECTORS_CAMPAIGN_PARAM}=${eventId}`
}

/**
 * Parse a `campaign` parameter, or null for anything unrecognised.
 *
 * Null rather than throwing, for the same reason `parseTimelineFocus` returns
 * null: this value comes off the URL, where a user can type, edit or truncate
 * it. A malformed target must degrade to "no target" — the ordinary Selectors
 * page — never to a broken route.
 *
 * `Number` rather than `parseInt`, also matching the timeline parser:
 * `parseInt("12abc")` is 12, which would send a reader to a campaign the URL
 * never named. The positivity check is load-bearing rather than tidy —
 * `Number("")` is 0 and 0 is an integer, so an empty `?campaign=` would
 * otherwise resolve to primary key 0. Django keys start at 1, so nothing
 * legitimate is turned away.
 */
export function parseCampaignFocus(raw: string | null | undefined): number | null {
	if (!raw) return null
	const id = Number(raw)
	return Number.isInteger(id) && id > 0 ? id : null
}

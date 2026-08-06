/**
 * Guest mode defaults and the login-migration handoff.
 *
 * Guest plans are in-memory only, but CalculatorProvider (and all its state)
 * unmounts the moment a guest navigates to /login. So "Sign in to save"
 * snapshots the guest's plan into sessionStorage — a short-lived baton pass,
 * not persistence. When the provider next mounts WITH a token and finds the
 * stash, it PATCHes the plan to the account and clears it.
 *
 * sessionStorage (not localStorage) keeps the stash tab-scoped and
 * auto-cleared when the tab closes, matching the in-memory-only design.
 */

import type { UserStats } from "../types"
import type {
	PlannedBannerPayload,
	PlannedPurchasePayload
} from "./calculatorFetchCalls"

/**
 * The stats a guest session starts with. Also the baseline for
 * statsAreDirty(): stats that still equal these defaults are never
 * migrated, so they can't clobber real stats on an existing account.
 */
export const DEFAULT_GUEST_STATS: UserStats = {
	current_carat: 0,
	current_paid_carat: 0,
	uma_ticket: 0,
	support_ticket: 0,
	uma_selector_ticket: 0,
	support_selector_ticket: 0,
	daily_carat: false,
	training_pass: false,
	// On by default to mirror the source sheet (and the backend model default),
	// so guest estimates match the sheet out of the box.
	misc_earnings: true,
	// New opt-in features start off; full-price paid pulls stays on to match the
	// historical behavior where paid carats always counted toward pulls.
	monthly_shop_tickets: false,
	discounted_paid_pulls: false,
	full_price_paid_pulls: true,
	// Off so planned purchases stay budgeting-only until explicitly opted into,
	// and estimates never move on their own.
	include_purchases_in_projection: false,
	webstore_bonus: false,
	club_rank: null,
	team_trials_rank: null,
	champions_meeting_rank: null,
	league_of_heroes_rank: null,
	ssr_crystals: 0,
	sr_crystals: 0,
	ssr_shards: 0,
	sr_shards: 0
}

const STASH_KEY = "guestPlanMigration.v1"

// A stash left behind by an abandoned login attempt shouldn't resurface
// days later and overwrite account data the user has since changed.
const STASH_MAX_AGE_MS = 60 * 60 * 1000 // 1 hour

export interface GuestPlanStash {
	version: 1
	createdAt: number
	/** null = guest never touched their stats, so don't migrate them */
	stats: UserStats | null
	/** Already in PATCH shape (FK ids, no id/tempId) — directly mergeable */
	banners: PlannedBannerPayload[]
	/**
	 * Optional so a stash written before this field existed still validates —
	 * the version stays 1 because an absent key degrades to "no purchases",
	 * which is exactly right rather than a reason to discard the whole plan.
	 */
	purchases?: PlannedPurchasePayload[]
}

/**
 * True if the guest actually changed anything from the defaults.
 * All UserStats fields are flat scalars, so a keyed compare is enough.
 */
export function statsAreDirty(stats: UserStats | null): boolean {
	if (!stats) return false
	return (Object.keys(DEFAULT_GUEST_STATS) as (keyof UserStats)[]).some(
		(key) => stats[key] !== DEFAULT_GUEST_STATS[key]
	)
}

/**
 * Snapshots the guest's plan before navigating to /login.
 * Writes nothing (and clears any stale stash) when there's nothing worth
 * migrating. sessionStorage can throw (e.g. some private-browsing modes) —
 * in that case the user just logs in without a migration, which beats crashing.
 */
export function stashGuestPlan(
	stats: UserStats | null,
	banners: PlannedBannerPayload[],
	purchases: PlannedPurchasePayload[] = []
): void {
	try {
		const dirtyStats = statsAreDirty(stats) ? stats : null
		if (!dirtyStats && banners.length === 0 && purchases.length === 0) {
			sessionStorage.removeItem(STASH_KEY)
			return
		}
		const stash: GuestPlanStash = {
			version: 1,
			createdAt: Date.now(),
			stats: dirtyStats,
			banners,
			purchases
		}
		sessionStorage.setItem(STASH_KEY, JSON.stringify(stash))
	} catch {
		// Storage unavailable — skip the handoff rather than break navigation.
	}
}

/**
 * Reads and validates the stash. Malformed or expired entries are
 * removed and treated as absent.
 */
export function readGuestPlanStash(): GuestPlanStash | null {
	try {
		const raw = sessionStorage.getItem(STASH_KEY)
		if (!raw) return null

		const parsed: unknown = JSON.parse(raw)
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			(parsed as GuestPlanStash).version !== 1 ||
			!Array.isArray((parsed as GuestPlanStash).banners) ||
			typeof (parsed as GuestPlanStash).createdAt !== "number"
		) {
			sessionStorage.removeItem(STASH_KEY)
			return null
		}

		const stash = parsed as GuestPlanStash
		if (Date.now() - stash.createdAt > STASH_MAX_AGE_MS) {
			sessionStorage.removeItem(STASH_KEY)
			return null
		}
		return stash
	} catch {
		return null
	}
}

export function clearGuestPlanStash(): void {
	try {
		sessionStorage.removeItem(STASH_KEY)
	} catch {
		// Nothing to do — worst case the stale-age guard cleans it up later.
	}
}
/**
 * Queries over the income ledger — the flat dated timeline `/calculator-data`
 * serves (see `backend/calculatorapi/ledger.py`).
 *
 * Every function here is a cumulative total from the projection anchor to an
 * arbitrary end date, matching the closed forms in ./cumulativeIncome. The
 * ledger carries no "as of today" gate of its own — it is a set of dated facts,
 * past rows included — so each query applies the lower bound itself. That is
 * deliberate: one anchor governs every income source rather than the server and
 * the client each holding their own.
 *
 * The sheet's equivalents are `Carat Calculator` cells AL42 (event lumps), AL43
 * (throughout carats) and AS42/AT42 (race events). Each bound below names the
 * one it reproduces, because they are NOT all the same and the differences are
 * load-bearing.
 */

import { THROUGHOUT_END_OFFSET_DAYS, THROUGHOUT_FILTER_GRACE_DAYS } from "../constants/gameConstants"
import type { IncomeLedgerRow, LedgerRowKind, ParsedLedgerRow } from "../types/ledger"
import { addUtcDays, ceilToTen, startOfUtcDay, utcDaysBetween } from "./utcDates"

const THROUGHOUT_DECAY_K = 2 // steepness of the early exponential leg
const THROUGHOUT_DECAY_LINEAR_SLOPE = 0.8 // slope of the linear fallback leg
const E_NEG_K = Math.exp(-THROUGHOUT_DECAY_K)

/**
 * Parse each row's dates once.
 *
 * The engine scans the whole ledger for every planned banner, so parsing ~235
 * date strings inside those passes is work that only needs doing a single time.
 */
export function parseLedger(rows: IncomeLedgerRow[]): ParsedLedgerRow[] {
	return rows.map((row) => ({
		...row,
		parsedDate: new Date(row.date),
		parsedThroughoutEnd: row.throughout_end ? new Date(row.throughout_end) : null,
	}))
}

export interface LedgerRewards {
	carats: number
	umaTickets: number
	supportTickets: number
	ssrShards: number
	ssrCrystals: number
	srShards: number
	srCrystals: number
}

const NO_REWARDS: LedgerRewards = {
	carats: 0,
	umaTickets: 0,
	supportTickets: 0,
	ssrShards: 0,
	ssrCrystals: 0,
	srShards: 0,
	srCrystals: 0,
}

/**
 * Everything game events pay as a LUMP on their start date, totalled over
 * `now <= date <= end` — sheet `AL42`:
 *   `SUM(FILTER(Timeline!$AT, $AG$2 <= Timeline!$AU, AH43 >= Timeline!$AU, ...))`
 *
 * Note the lower bound is `$AG$2` (NOW), not `$AG$3` (TODAY). An event that
 * opened earlier today has already paid out, so its carats are in the balance
 * the user typed in — counting them again would double them. This is the one
 * place the live instant is used rather than midnight.
 *
 * `carats_throughout` is deliberately excluded: it is a pool, not a lump, and is
 * handled by cumulativeThroughoutCarats below.
 */
export function cumulativeEventRewards(
	ledger: ParsedLedgerRow[],
	now: Date,
	end: Date
): LedgerRewards {
	const total = { ...NO_REWARDS }

	for (const row of ledger) {
		if (row.kind !== "event") continue
		if (row.parsedDate < now || row.parsedDate > end) continue
		total.carats += row.carats
		total.umaTickets += row.uma_tickets
		total.supportTickets += row.support_tickets
		total.ssrShards += row.ssr_shards
		total.ssrCrystals += row.ssr_crystals
		total.srShards += row.sr_shards
		total.srCrystals += row.sr_crystals
	}

	return total
}

/**
 * How many Champions Meetings / League of Heroes events pay out by `end` —
 * sheet `AS42`/`AT42`:
 *   `SUM(FILTER(Timeline!$BL, Timeline!$BE < AH43 + 1))`
 *
 * Two bounds worth reading carefully:
 *
 * - The sheet has NO lower bound here, because its `CM Check`/`LoH Check`
 *   columns are themselves populated only from today onward (verified against
 *   live values: zero flagged rows predate today). Our ledger carries past rows,
 *   so the gate lives here instead — `date >= today`, midnight, matching where
 *   the sheet's own column starts.
 * - The upper bound is `< end + 1 day`, NOT `<= end`. Race rows are dated at
 *   midnight while banners end at 21:59:59, so this credits an event finishing
 *   the day after a banner closes. That is the sheet's behaviour and it is
 *   ported deliberately; the parity harness is what confirms it.
 *
 * The caller multiplies by the user's rank payout — the ledger rows are
 * indicators and carry no amounts.
 */
export function countRaceEvents(
	ledger: ParsedLedgerRow[],
	kind: LedgerRowKind,
	today: Date,
	end: Date
): number {
	const from = startOfUtcDay(today)
	const to = addUtcDays(end, 1)
	let count = 0
	for (const row of ledger) {
		if (row.kind !== kind) continue
		if (row.parsedDate < from || row.parsedDate >= to) continue
		count++
	}
	return count
}

/**
 * How much of one event's `carats_throughout` pool is still collectable as of
 * `now` — a single figure per event, independent of any banner window.
 *
 * That independence is the point. An earlier model spread each pool across every
 * banner window it overlapped, so a banner's estimate depended on how the user
 * had sliced their plan. The sheet evaluates the curve once, from today, and
 * credits the result whole.
 *
 * The curve blends a fast exponential early decay with a slower linear tail,
 * taking whichever leg has MORE left at a given moment: the exponential
 * dominates just after the banner opens (front-loading the reward) and the
 * linear leg takes over for the rest. It self-clamps outside the span — before
 * the banner starts both legs exceed 1 so MIN caps at 1 (nothing collected yet),
 * after it both go negative so MAX floors at 0 (pool exhausted).
 *
 * The curve runs over the BANNER's span shortened by THROUGHOUT_END_OFFSET_DAYS.
 * `throughout_end` already arrives as the banner's end rather than the event's
 * padded one — the backend strips that buffer, so there is no constant to keep
 * in sync here any more.
 */
function remainingThroughoutForRow(row: ParsedLedgerRow, now: Date): number {
	if (!row.carats_throughout || !row.parsedThroughoutEnd) return 0

	const bannerStart = row.parsedDate
	const curveEnd = addUtcDays(row.parsedThroughoutEnd, -THROUGHOUT_END_OFFSET_DAYS)

	const span = utcDaysBetween(bannerStart, curveEnd)
	// A banner shorter than the trim has no curve to walk; treat it as spent
	// rather than dividing by zero or a negative.
	if (span <= 0) return 0

	const fraction = Math.min(Math.max(utcDaysBetween(bannerStart, now) / span, 0), 1)
	const exponential =
		(Math.exp(-THROUGHOUT_DECAY_K * fraction) - E_NEG_K) / (1 - E_NEG_K)
	const linear = 1 - fraction

	const share = Math.max(
		0,
		Math.min(1, exponential),
		Math.min(1, linear * THROUGHOUT_DECAY_LINEAR_SLOPE)
	)

	return ceilToTen(share * row.carats_throughout)
}

/**
 * Total throughout carats collectable by `end`, counting from `now` — sheet
 * `AL43`:
 *   `SUM(FILTER(Timeline!$AZ, $AG$2 <= Timeline!$BA, AH43 >= Timeline!$BA - $AQ$32))`
 *
 * An event qualifies when both hold:
 *   - its banner has not already finished (`bannerEnd >= now`) — carats from a
 *     closed banner are gone, not bankable;
 *   - its banner ends within THROUGHOUT_FILTER_GRACE_DAYS after `end`.
 *
 * There is deliberately no exclusion for banners already running: any number can
 * be in flight at once and all of them count, each contributing only what it has
 * left.
 */
export function cumulativeThroughoutCarats(
	ledger: ParsedLedgerRow[],
	now: Date,
	end: Date
): number {
	let total = 0
	for (const row of ledger) {
		const bannerEnd = row.parsedThroughoutEnd
		if (!row.carats_throughout || !bannerEnd) continue
		if (bannerEnd < now) continue
		if (addUtcDays(bannerEnd, -THROUGHOUT_FILTER_GRACE_DAYS) > end) continue
		total += remainingThroughoutForRow(row, now)
	}
	return total
}

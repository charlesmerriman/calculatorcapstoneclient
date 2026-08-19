/**
 * Uncap shard and crystal accrual.
 *
 * What remains of a much larger module of income helpers. The rest —
 * per-window occurrence counters for daily carats, login campaigns, monthly
 * shop restocks and the training pass — existed only to serve the legacy
 * windowed walk, and went with it. The ledger engine asks a different question
 * (a cumulative total from today to one end date, see utils/cumulativeIncome
 * and utils/incomeLedger) and needs none of them.
 *
 * This part survives because useUncapCrystals is not part of that engine: it
 * answers for one user-chosen window, which is still genuinely a windowed
 * question.
 */

/**
 * The three reward-bearing shapes the accrual below reads, kept minimal and
 * structural so callers can pass their own pre-parsed rows.
 *
 * Dates arrive already parsed because the per-banner projection calls this once
 * per banner — re-parsing every event's date string on each of those passes was
 * measurable, and the caller already parses them once for its other income.
 */
export interface ShardEventLike {
	parsedStart: Date | null
	ssr_shard_amount: number
	sr_shard_amount: number
	ssr_crystal_amount: number
	sr_crystal_amount: number
}

export interface ShardRaceLike {
	parsedDate: Date
}

export interface ShardRankLike {
	ssr_shard_amount: number
	sr_shard_amount: number
}

export interface UncapAccrual {
	ssrShards: number
	srShards: number
	ssrCrystals: number
	srCrystals: number
}

export interface UncapAccrualInput {
	windowStart: Date
	windowEnd: Date
	events: ShardEventLike[]
	meetings: ShardRaceLike[]
	leagueEvents: ShardRaceLike[]
	championsMeetingRank: ShardRankLike | undefined
	leagueOfHeroesRank: ShardRankLike | undefined
}

/**
 * Shards and crystals earned in the half-open window `(windowStart, windowEnd]`.
 *
 * Called by useUncapCrystals for one user-chosen window. It was also shared
 * with the legacy per-banner walk, which chained one window per banner; that
 * caller is gone, so the tiling property below no longer has a second user —
 * but it is still what makes the window's arithmetic unambiguous, and the
 * panel's own start/end are user-supplied, so it stays as specified.
 *
 * Shards and crystals are always a lump on an event's start date — there is no
 * shard equivalent of carats_throughout, so nothing here is prorated.
 *
 * The window is half-open on the left: `(a,b]` then `(b,c]` counts everything
 * in `(a,c]` exactly once, with no double-counted boundary day.
 */
export function sumUncapAccrual(input: UncapAccrualInput): UncapAccrual {
	const { windowStart, windowEnd } = input
	const accrual: UncapAccrual = {
		ssrShards: 0,
		srShards: 0,
		ssrCrystals: 0,
		srCrystals: 0,
	}

	for (const event of input.events) {
		const start = event.parsedStart
		if (!start || start <= windowStart || start > windowEnd) continue
		accrual.ssrShards += event.ssr_shard_amount
		accrual.srShards += event.sr_shard_amount
		accrual.ssrCrystals += event.ssr_crystal_amount
		accrual.srCrystals += event.sr_crystal_amount
	}

	// Race payouts land on the event's END date, unlike game events.
	for (const [races, rank] of [
		[input.meetings, input.championsMeetingRank] as const,
		[input.leagueEvents, input.leagueOfHeroesRank] as const,
	]) {
		if (!rank) continue
		for (const race of races) {
			if (race.parsedDate <= windowStart || race.parsedDate > windowEnd) continue
			accrual.ssrShards += rank.ssr_shard_amount
			accrual.srShards += rank.sr_shard_amount
		}
	}

	return accrual
}

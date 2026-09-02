import { useMemo } from "react"
import { SHARDS_PER_CRYSTAL } from "../constants/gameConstants"
import { sumUncapAccrual } from "../utils/incomeCalculationUtils"
import { cumulativeTrainingPassIncome } from "../utils/cumulativeIncome"
import { startOfUtcDay } from "../utils/utcDates"
import type {
	UserStats,
	GameEvent,
	ChampionsMeetingRank,
	LeagueOfHeroesRank,
} from "../types"
import type { CalculationConstants } from "../types/constants"
import type { IncomeLedgerRow, LedgerRowKind } from "../types/ledger"

/**
 * The race payout instants of one kind, taken from the ledger.
 *
 * This panel used to read `end_date` straight off championsMeetingData /
 * leagueOfHeroesData, which quietly made it a SECOND opinion about when a race
 * event pays. It is not: a Champions Meeting settles its placements 24 hours
 * before its window closes (`RACE_REWARD_LEAD_TIME` in
 * `backend/calculatorapi/ledger.py`), so the raw end date paid the shards a day
 * later here than the carats landed in the banner rows — the same event on two
 * clocks. Reading the ledger means the offset lives in exactly one place and
 * this panel inherits it rather than re-deriving it.
 *
 * Undated events are already dropped server-side, so there is no invalid date
 * to guard against.
 */
function racePayoutDates(ledger: IncomeLedgerRow[], kind: LedgerRowKind) {
	return ledger
		.filter((row) => row.kind === kind)
		.map((row) => ({ parsedDate: new Date(row.date) }))
}

export interface UncapCrystals {
	ssrCrystals: number
	ssrShards: number
	srCrystals: number
	srShards: number
}

/**
 * Calculates projected uncap crystal and shard counts at a given banner end date.
 *
 * Starts from the user's current inventory, then adds shards/crystals from four
 * sources whose dates fall between now and the selected end date:
 *   1. GameEvent reward amounts (shards/crystals are always a lump on start_date --
 *      carats_throughout only ever affects carats, never shards/crystals)
 *   2. Champions Meeting payouts (based on the user's rank)
 *   3. League of Heroes payouts (based on the user's rank)
 *   4. The paid Training Pass's monthly SSR shard
 *
 * The two race sources come from the income ledger rather than from the event
 * lists, so they land on the same instant the carats do — see racePayoutDates.
 *
 * The Training Pass is the one source here that does NOT go through
 * sumUncapAccrual. It is monthly rather than dated, so it has no reward rows to
 * window; it comes straight from the ledger engine's own helper instead, called
 * on the same UTC-midnight anchor the banner rows use. Reimplementing its month
 * count here would give this panel a second opinion about the same reward.
 *
 * Finally, accumulated shards are converted to crystals using the 20-shards-per-crystal rule.
 */
export function useUncapCrystals(
	userStatsData: UserStats | null,
	gameEventsData: GameEvent[],
	incomeLedger: IncomeLedgerRow[],
	championsMeetingRankData: ChampionsMeetingRank[],
	leagueOfHeroesRankData: LeagueOfHeroesRank[],
	selectedEndDate: string | null,
	constants: CalculationConstants
): UncapCrystals {
	return useMemo(() => {
		const zero = { ssrCrystals: 0, ssrShards: 0, srCrystals: 0, srShards: 0 }
		if (!userStatsData || !selectedEndDate) return zero

		const now = new Date()
		const endDate = new Date(selectedEndDate)

		// One window, now -> the chosen banner end. The arithmetic itself is
		// shared with the per-banner projection so the panel and the banner rows
		// can never disagree about the same span.
		const accrual = sumUncapAccrual({
			windowStart: now,
			windowEnd: endDate,
			events: gameEventsData.map((ge) => ({
				...ge,
				parsedStart: ge.start_date ? new Date(ge.start_date) : null,
			})),
			meetings: racePayoutDates(incomeLedger, "champions_meeting"),
			leagueEvents: racePayoutDates(incomeLedger, "league_of_heroes"),
			championsMeetingRank: championsMeetingRankData.find(
				(r) => r.id === userStatsData.champions_meeting_rank
			),
			leagueOfHeroesRank: leagueOfHeroesRankData.find(
				(r) => r.id === userStatsData.league_of_heroes_rank
			),
		})

		// Paid tier only, and nothing at all before the pass launches — the helper
		// clamps the span to its launch date.
		const pass = cumulativeTrainingPassIncome(
			startOfUtcDay(now), endDate, userStatsData.training_pass, constants
		)

		const totalSsrShards =
			userStatsData.ssr_shards + accrual.ssrShards + pass.ssrShards
		const totalSrShards = userStatsData.sr_shards + accrual.srShards
		let totalSsrCrystals = userStatsData.ssr_crystals + accrual.ssrCrystals
		let totalSrCrystals = userStatsData.sr_crystals + accrual.srCrystals

		// Every 20 shards converts to 1 crystal; remainder stays as shards.
		totalSsrCrystals += Math.floor(totalSsrShards / SHARDS_PER_CRYSTAL)
		totalSrCrystals += Math.floor(totalSrShards / SHARDS_PER_CRYSTAL)

		return {
			ssrCrystals: totalSsrCrystals,
			ssrShards: totalSsrShards % SHARDS_PER_CRYSTAL,
			srCrystals: totalSrCrystals,
			srShards: totalSrShards % SHARDS_PER_CRYSTAL,
		}
	}, [
		userStatsData,
		gameEventsData,
		incomeLedger,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		selectedEndDate,
		constants,
	])
}

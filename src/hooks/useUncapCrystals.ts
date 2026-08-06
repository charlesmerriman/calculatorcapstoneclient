import { useMemo } from "react"
import { SHARDS_PER_CRYSTAL } from "../constants/gameConstants"
import { sumUncapAccrual } from "../utils/incomeCalculationUtils"
import type {
	UserStats,
	GameEvent,
	ChampionsMeeting,
	ChampionsMeetingRank,
	LeagueOfHeroes,
	LeagueOfHeroesRank,
} from "../types"

export interface UncapCrystals {
	ssrCrystals: number
	ssrShards: number
	srCrystals: number
	srShards: number
}

/**
 * Calculates projected uncap crystal and shard counts at a given banner end date.
 *
 * Starts from the user's current inventory, then adds shards/crystals from three
 * sources whose dates fall between now and the selected end date:
 *   1. GameEvent reward amounts (shards/crystals are always a lump on start_date --
 *      carats_throughout only ever affects carats, never shards/crystals)
 *   2. Champions Meeting payouts (based on the user's rank)
 *   3. League of Heroes payouts (based on the user's rank)
 *
 * Finally, accumulated shards are converted to crystals using the 20-shards-per-crystal rule.
 */
export function useUncapCrystals(
	userStatsData: UserStats | null,
	gameEventsData: GameEvent[],
	championsMeetingData: ChampionsMeeting[],
	championsMeetingRankData: ChampionsMeetingRank[],
	leagueOfHeroesData: LeagueOfHeroes[],
	leagueOfHeroesRankData: LeagueOfHeroesRank[],
	selectedEndDate: string | null
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
			meetings: championsMeetingData.map((m) => ({
				parsedDate: new Date(m.end_date),
			})),
			leagueEvents: leagueOfHeroesData.map((l) => ({
				parsedDate: new Date(l.end_date),
			})),
			championsMeetingRank: championsMeetingRankData.find(
				(r) => r.id === userStatsData.champions_meeting_rank
			),
			leagueOfHeroesRank: leagueOfHeroesRankData.find(
				(r) => r.id === userStatsData.league_of_heroes_rank
			),
		})

		const totalSsrShards = userStatsData.ssr_shards + accrual.ssrShards
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
		championsMeetingData,
		championsMeetingRankData,
		leagueOfHeroesData,
		leagueOfHeroesRankData,
		selectedEndDate,
	])
}

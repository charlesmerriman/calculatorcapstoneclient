import { useMemo } from "react"
import type {
	UserStats,
	EventReward,
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

const SHARDS_PER_CRYSTAL = 20

/**
 * Calculates projected uncap crystal and shard counts at a given banner end date.
 *
 * Starts from the user's current inventory, then adds shards/crystals from three
 * sources whose dates fall between now and the selected end date:
 *   1. EventReward entries (game events)
 *   2. Champions Meeting payouts (based on the user's rank)
 *   3. League of Heroes payouts (based on the user's rank)
 *
 * Finally, accumulated shards are converted to crystals using the 20-shards-per-crystal rule.
 */
export function useUncapCrystals(
	userStatsData: UserStats | null,
	eventRewardsData: EventReward[],
	championsMeetingData: ChampionsMeeting[],
	championsMeetingRankData: ChampionsMeetingRank[],
	leagueOfHeroesData: LeagueOfHeroes[],
	leagueOfHeroesRankData: LeagueOfHeroesRank[],
	selectedEndDate: string | null
): UncapCrystals {
	return useMemo(() => {
		const zero = { ssrCrystals: 0, ssrShards: 0, srCrystals: 0, srShards: 0 }
		if (!userStatsData || !selectedEndDate) return zero

		let totalSsrShards = userStatsData.ssr_shards
		let totalSrShards = userStatsData.sr_shards
		let totalSsrCrystals = userStatsData.ssr_crystals
		let totalSrCrystals = userStatsData.sr_crystals

		const now = new Date()
		const endDate = new Date(selectedEndDate)

		for (const ev of eventRewardsData) {
			const date = new Date(ev.date)
			if (date > now && date <= endDate) {
				totalSsrShards += ev.ssr_shard_amount
				totalSrShards += ev.sr_shard_amount
				totalSsrCrystals += ev.ssr_crystal_amount
				totalSrCrystals += ev.sr_crystal_amount
			}
		}

		const userCmRank = championsMeetingRankData.find(
			(r) => r.id === userStatsData.champions_meeting_rank
		)
		for (const meet of championsMeetingData) {
			const date = new Date(meet.end_date)
			if (date > now && date <= endDate) {
				totalSsrShards += userCmRank?.ssr_shard_amount ?? 0
				totalSrShards += userCmRank?.sr_shard_amount ?? 0
			}
		}

		const userLohRank = leagueOfHeroesRankData.find(
			(r) => r.id === userStatsData.league_of_heroes_rank
		)
		for (const loh of leagueOfHeroesData) {
			const date = new Date(loh.end_date)
			if (date > now && date <= endDate) {
				totalSsrShards += userLohRank?.ssr_shard_amount ?? 0
				totalSrShards += userLohRank?.sr_shard_amount ?? 0
			}
		}

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
		eventRewardsData,
		championsMeetingData,
		championsMeetingRankData,
		leagueOfHeroesData,
		leagueOfHeroesRankData,
		selectedEndDate,
	])
}

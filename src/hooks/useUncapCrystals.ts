import { useMemo } from "react"
import type { UserStats, EventReward } from "../types"

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
 * Starts from the user's current inventory, adds all event reward shards/crystals
 * whose date falls between now and the selected end date, then converts accumulated
 * shards into crystals using the 20-shards-per-crystal rule.
 */
export function useUncapCrystals(
	userStatsData: UserStats | null,
	eventRewardsData: EventReward[],
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

		// Every 20 shards converts to 1 crystal; remainder stays as shards.
		totalSsrCrystals += Math.floor(totalSsrShards / SHARDS_PER_CRYSTAL)
		totalSrCrystals += Math.floor(totalSrShards / SHARDS_PER_CRYSTAL)

		return {
			ssrCrystals: totalSsrCrystals,
			ssrShards: totalSsrShards % SHARDS_PER_CRYSTAL,
			srCrystals: totalSrCrystals,
			srShards: totalSrShards % SHARDS_PER_CRYSTAL,
		}
	}, [userStatsData, eventRewardsData, selectedEndDate])
}

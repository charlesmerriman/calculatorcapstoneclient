/**
 * Daily legend race types.
 *
 * A release is a batch of umas joining the Daily Legend Races, usually with an
 * anniversary. Once in, each uma has her own race, once a day, forever, so a
 * player can grind several at once. Before that, an uma's only source of
 * pieces was her original limited Legend Race event.
 *
 * Nothing here touches the projection: pieces buy nothing the calculator
 * counts. The page and the Timeline marker read it, nothing else.
 */

/** One uma tile. Mirrors DailyLegendRaceUmaSerializer. */
export interface DailyLegendRaceUma {
	id: number
	name: string
	image: string | null
	/**
	 * Initial star count, 1-3. Resolved on the server (a blank rarity counts
	 * as 3), so the client groups on it as-is and never repeats that rule.
	 */
	rarity: 1 | 2 | 3
}

/** Mirrors DailyLegendRaceReleaseSerializer. */
export interface DailyLegendRaceRelease {
	id: number
	/** "2nd Anniversary" */
	name: string
	/** Optional art. Not shown anywhere yet. */
	image: string | null
	/**
	 * The banner this batch arrives with, as a bare id (null until an editor
	 * links one). The Timeline puts the batch on that banner's card. Optional
	 * because the API sent no such key before api #88.
	 */
	banner_timeline?: number | null
	/**
	 * The banner's resolved start plus the release's own day offset, or null
	 * when the release has no banner yet. A null release is not on the site:
	 * `datedReleases()` drops it.
	 *
	 * No `end_date`, and the API sends none. A batch arrives and stays.
	 */
	start_date: string | null
	is_predicted: boolean
	applied_offset_days: number
	/** Sorted by the server: ★3 first, then by name. */
	umas: DailyLegendRaceUma[]
}

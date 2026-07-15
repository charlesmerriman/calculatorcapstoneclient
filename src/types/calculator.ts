/**
 * Aggregate types that combine the domain types into larger structures.
 * These are separated because they depend on everything else — keeping
 * them in their own file prevents circular imports.
 *
 * TYPESCRIPT CONCEPT: Import Types
 * `import type` is a TypeScript-only import that's erased at compile time.
 * It tells the bundler "I only need this for type checking, not at runtime."
 * This prevents accidental circular dependencies and reduces bundle size.
 * Always use `import type` when you're only importing interfaces/types.
 */

import type { Dispatch, SetStateAction } from "react"
import type {
	BannerUma,
	BannerSupport,
	BannerTimelineForViewing
} from "./banner"
import type {
	ClubRank,
	TeamTrialsRank,
	ChampionsMeetingRank,
	LeagueOfHeroesRank
} from "./ranks"
import type { UserStats, UserPlannedBanner } from "./user"
import type { EventReward, GameEvent, ChampionsMeeting, LeagueOfHeroes } from "./events"

/** The full payload returned by GET /calculator-data.
 * `user_stats_data` is null for anonymous (guest) requests — the provider
 * seeds DEFAULT_GUEST_STATS in that case. */
export interface CalculatorData {
	user_stats_data: UserStats | null
	club_rank_data: ClubRank[]
	team_trials_rank_data: TeamTrialsRank[]
	champions_meeting_rank_data: ChampionsMeetingRank[]
	league_of_heroes_rank_data: LeagueOfHeroesRank[]
	banner_uma_data: BannerUma[]
	banner_support_data: BannerSupport[]
	user_planned_banner_data: UserPlannedBanner[]
	events_data: GameEvent[]
	champions_meeting_data: ChampionsMeeting[]
	league_of_heroes_event_data: LeagueOfHeroes[]
	banner_timeline_data: BannerTimelineForViewing[]
}

/**
 * The timeline merges banner timelines and champions meetings into one
 * sorted array. Each element is one or the other.
 *
 * TYPESCRIPT CONCEPT: Union Arrays
 * (ChampionsMeeting | BannerTimelineForViewing)[] means each element
 * in the array could be either type. To figure out which one you have,
 * use a type guard or check for a distinguishing property:
 *   if ("track" in event) { // it's a ChampionsMeeting }
 */
export type OrganizedTimelineData = (
	| ChampionsMeeting
	| LeagueOfHeroes
	| BannerTimelineForViewing
)[]

/**
 * The shape of the Calculator context value.
 *
 * TYPESCRIPT CONCEPT: React.Dispatch<SetStateAction<T>>
 * This is the type of the setter function from useState. It accepts either
 * a new value of type T, or a callback (prev: T) => T. When you expose a
 * setState function through context, always type it this way rather than
 * as a generic function type — it gives consumers full autocomplete.
 */
export interface CalculatorContextType {
	userStatsData: UserStats | null
	clubRankData: ClubRank[]
	teamTrialsRankData: TeamTrialsRank[]
	championsMeetingRankData: ChampionsMeetingRank[]
	leagueOfHeroesRankData: LeagueOfHeroesRank[]
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	eventRewardsData: EventReward[]
	championsMeetingData: ChampionsMeeting[]
	leagueOfHeroesData: LeagueOfHeroes[]
	userPlannedBannerData: UserPlannedBanner[]
	stagedBanners: UserPlannedBanner[]
	timerIsGoing: boolean
	isDropdown: boolean
	organizedTimelineData: OrganizedTimelineData
	handleDropDownToggle: () => void
	saveNow: () => Promise<void>
	setIsDropdown: Dispatch<SetStateAction<boolean>>
	setUserPlannedBannerData: Dispatch<SetStateAction<UserPlannedBanner[]>>
	setStagedBanners: Dispatch<SetStateAction<UserPlannedBanner[]>>
	setUserStatsData: Dispatch<SetStateAction<UserStats | null>>
}
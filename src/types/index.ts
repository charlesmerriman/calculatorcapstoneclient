/**
 * TYPESCRIPT CONCEPT: Barrel Files
 *
 * A barrel file re-exports everything from multiple modules through
 * a single entry point. This means consumers can write:
 *   import type { Uma, ClubRank, UserStats } from "../types"
 * instead of:
 *   import type { Uma } from "../types/banner"
 *   import type { ClubRank } from "../types/ranks"
 *   import type { UserStats } from "../types/user"
 *
 * Barrel files keep imports clean while letting you organize types
 * into logical groupings internally.
 */

export type {
	BannerTimeline,
	Uma,
	SupportCard,
	BannerUma,
	BannerSupport,
	BannerTimelineForViewing
} from "./banner"

export type {
	ClubRank,
	TeamTrialsRank,
	TeamTrailsRank,
	ChampionsMeetingRank,
	LeagueOfHeroesRank
} from "./ranks"

export type {
	UserStats,
	UserPlannedBanner,
	SavedPlannedBanner,
	LocalPlannedBanner
} from "./user"

export { isSavedBanner, isLocalBanner } from "./user"

export type {
	GameEvent,
	ChampionsMeeting,
	LeagueOfHeroes
} from "./events"

export type {
	CalculatorData,
	OrganizedTimelineData,
	CalculatorContextType
} from "./calculator"

export type {
	ChangeCategory,
	ChangelogChange,
	ChangelogEntry
} from "./changelog"
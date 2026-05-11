import React, { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { CalculatorContext } from "./CalculatorContext"
import type {
	CalculatorData,
	UserStats,
	ClubRank,
	TeamTrialsRank,
	ChampionsMeetingRank,
	LeagueOfHeroesRank,
	UserPlannedBanner,
	BannerUma,
	BannerSupport,
	EventReward,
	ChampionsMeeting,
	LeagueOfHeroes,
	OrganizedTimelineData
} from "../types"
import {
	initialCalculatorDataFetch,
	userCalculatorDataPatch
} from "./calculatorFetchCalls"
import { useAutoSave } from "../hooks/useAutoSave"

interface CalculatorProviderProps {
	children: React.ReactNode
}

export const CalculatorProvider = ({ children }: CalculatorProviderProps) => {
	/**
	 * TYPESCRIPT CONCEPT: useState Generic Parameter
	 *
	 * useState<UserStats | null>(null) tells TypeScript the state can be
	 * either a UserStats object or null. Without the generic, TypeScript
	 * would infer the type from the initial value alone — useState(null)
	 * would be typed as `null` forever, and you couldn't set it to UserStats later.
	 *
	 * For arrays, useState<ClubRank[]>([]) works because TypeScript can't infer
	 * the element type from an empty array — [] would become `never[]`.
	 *
	 * NOTE: We no longer use `ClubRank[] | []` — an empty ClubRank[] already
	 * covers the empty case. The `| []` was redundant and added noise.
	 */
	const [userStatsData, setUserStatsData] = useState<UserStats | null>(null)
	const [clubRankData, setClubRankData] = useState<ClubRank[]>([])
	const [teamTrialsRankData, setTeamTrialsRankData] = useState<TeamTrialsRank[]>([])
	const [championsMeetingRankData, setChampionsMeetingRankData] = useState<ChampionsMeetingRank[]>([])
	const [leagueOfHeroesRankData, setLeagueOfHeroesRankData] = useState<LeagueOfHeroesRank[]>([])
	const [umaBannerData, setUmaBannerData] = useState<BannerUma[]>([])
	const [supportBannerData, setSupportBannerData] = useState<BannerSupport[]>([])
	const [userPlannedBannerData, setUserPlannedBannerData] = useState<UserPlannedBanner[]>([])
	const [eventRewardsData, setEventRewardsData] = useState<EventReward[]>([])
	const [championsMeetingData, setChampionsMeetingData] = useState<ChampionsMeeting[]>([])
	const [leagueOfHeroesData, setLeagueOfHeroesData] = useState<LeagueOfHeroes[]>([])
	const [organizedTimelineData, setOrganizedTimelineData] = useState<OrganizedTimelineData>([])
	const [isDropdown, setIsDropdown] = useState(true)

	const handleDropDownToggle = (): void => {
		setIsDropdown((prev) => !prev)
	}

	const prepareBannerData = useCallback(() => {
		return userPlannedBannerData
			.filter(
				(plannedBanner) =>
					plannedBanner.banner_uma || plannedBanner.banner_support
			)
			.map((plannedBanner) => {
				/**
				 * TYPESCRIPT CONCEPT: Destructuring with Unused Variables
				 *
				 * We destructure tempId out because we don't want to send it to the server.
				 * The underscore prefix (_tempId) is a common convention to signal "intentionally
				 * unused." We also need the eslint disable because the linter would otherwise
				 * flag it. An alternative is to use a utility function like omit(obj, 'tempId').
				 */
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const { tempId: _tempId, ...rest } = plannedBanner
				return {
					...rest,
					banner_uma: plannedBanner.banner_uma?.id ?? null,
					banner_support: plannedBanner.banner_support?.id ?? null
				}
			})
	}, [userPlannedBannerData])

	const performSave = useCallback(async (): Promise<void> => {
		try {
			const response = await userCalculatorDataPatch(userStatsData, prepareBannerData())
			if (!response.ok) {
				toast.error("Save failed. Your changes may not have been saved.")
			} else {
				toast.success("Saved")
			}
		} catch {
			toast.error("Save failed. Check your connection.")
		}
	}, [userStatsData, prepareBannerData])

	const { timerIsGoing, startTimer, saveNow } = useAutoSave({
		saveFn: performSave,
		delayMs: 5000
	})

	useEffect(() => {
		initialCalculatorDataFetch()
			.then((response) => response.json())
			.then((data: CalculatorData) => {
				/**
				 * TYPESCRIPT CONCEPT: Extending Objects with Extra Fields
				 *
				 * We add `_source` to each event for sorting purposes.
				 * By defining these as inline objects with `as const` on the _source
				 * value, TypeScript infers the literal types "banner" | "champions"
				 * rather than just `string`. This helps with type narrowing later.
				 */
				const mergedEvents = [
					...data.banner_timeline_data.map((event) => ({
						...event,
						_source: "banner" as const
					})),
					...data.champions_meeting_data.map((event) => ({
						...event,
						_source: "champions" as const
					})),
					...data.league_of_heroes_event_data.map((event) => ({
						...event,
						_source: "leagueofheroes" as const
					}))
				]

				const sortedMergedEvents = mergedEvents.sort((a, b) => {
					const timeDiff =
						new Date(a.start_date).getTime() -
						new Date(b.start_date).getTime()

					if (timeDiff !== 0) return timeDiff

					if (a._source === "champions" && b._source === "banner") return -1
					if (a._source === "banner" && b._source === "champions") return 1

					return 0
				})

				setUserStatsData(data.user_stats_data)
				setClubRankData(data.club_rank_data)
				setTeamTrialsRankData(data.team_trials_rank_data)
				setChampionsMeetingRankData(data.champions_meeting_rank_data)
				setLeagueOfHeroesRankData(data.league_of_heroes_rank_data)
				setUmaBannerData(data.banner_uma_data)
				setSupportBannerData(data.banner_support_data)
				setUserPlannedBannerData(data.user_planned_banner_data)
				setEventRewardsData(data.events_data.flatMap((event) => event.rewards))
				setChampionsMeetingData(data.champions_meeting_data)
				setLeagueOfHeroesData(data.league_of_heroes_event_data)
				setOrganizedTimelineData(sortedMergedEvents)
			})
			.catch((error: unknown) => {
				console.error("Error fetching calculator data:", error)
				toast.error("Failed to load data. Please refresh.")
			})
	}, [])

	// prevStatsRef tracks what userStatsData was on the last effect run.
	// When it's null, this is either the initial mount or the initial data load — both should
	// be skipped. Only start the timer once real user edits happen (prevStatsRef is non-null).
	const prevStatsRef = useRef<UserStats | null>(null)
	useEffect(() => {
		const wasEmpty = prevStatsRef.current === null
		prevStatsRef.current = userStatsData
		if (wasEmpty) return
		startTimer()
	}, [startTimer, userStatsData, userPlannedBannerData])

	const value = {
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		umaBannerData,
		supportBannerData,
		userPlannedBannerData,
		eventRewardsData,
		championsMeetingData,
		leagueOfHeroesData,
		timerIsGoing,
		isDropdown,
		organizedTimelineData,
		handleDropDownToggle,
		saveNow,
		setIsDropdown,
		setUserPlannedBannerData,
		setUserStatsData
	}

	return (
		<CalculatorContext.Provider value={value}>
			{children}
		</CalculatorContext.Provider>
	)
}
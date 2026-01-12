import React, { useCallback, useEffect, useRef, useState } from "react"
import { CalculatorContext } from "./CalculatorContext"
import type {
	CalculatorData,
	UserStats,
	ClubRank,
	TeamTrailsRank,
	ChampionsMeetingRank,
	UserPlannedBanner,
	BannerUma,
	BannerSupport,
	EventRewards,
	ChampionsMeeting
} from "./calculatorTypes"
import {
	initialCalculatorDataFetch,
	userCalculatorDataPatch
} from "./calculatorFetchCalls"

type CalculatorProviderProps = {
	children: React.ReactNode
}

export const CalculatorProvider = ({ children }: CalculatorProviderProps) => {
	const [userStatsData, setUserStatsData] = useState<UserStats | null>(null)
	const [clubRankData, setClubRankData] = useState<ClubRank[] | []>([])
	const [teamTrialsRankData, setTeamTrialsRankData] = useState<
		TeamTrailsRank[] | []
	>([])
	const [championsMeetingRankData, setChampionsMeetingRankData] = useState<
		ChampionsMeetingRank[] | []
	>([])
	const [umaBannerData, setUmaBannerData] = useState<BannerUma[] | []>([])
	const [supportBannerData, setSupportBannerData] = useState<
		BannerSupport[] | []
	>([])
	const [userPlannedBannerData, setUserPlannedBannerData] = useState<
		UserPlannedBanner[] | []
	>([])
	const [eventRewardsData, setEventRewardsData] = useState<EventRewards[] | []>(
		[]
	)
	const [championsMeetingData, setChampionsMeetingData] = useState<
		ChampionsMeeting[] | []
	>([])
	const [organizedTimelineData, setOrganizedTimelineData] = useState([])
	

	const [timerIsGoing, setTimerIsGoing] = useState(false)
	const timer = useRef<number| null>(null)
	
	const [isDropdown, setIsDropdown] = useState(true)

	const handleDropDownToggle = () => {
		if (isDropdown) {
			setIsDropdown(false)
		} else {
			setIsDropdown(true)
		}
	}

	const prepareBannerData = useCallback(() => {
	return userPlannedBannerData
		?.filter(
			(plannedBanner) =>
				plannedBanner.banner_uma || plannedBanner.banner_support
		)
		.map((plannedBanner) => {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { tempId, ...rest } = plannedBanner
			return {
				...rest,
				banner_uma: plannedBanner.banner_uma?.id || null,
				banner_support: plannedBanner.banner_support?.id || null
			}
		})
}, [userPlannedBannerData])

const startTimer = useCallback(() => {
	if (timer.current) {
		clearTimeout(timer.current)
	}

	setTimerIsGoing(true)

	timer.current = setTimeout(() => {
		userCalculatorDataPatch(userStatsData, prepareBannerData())
		setTimerIsGoing(false)
	}, 5000)
}, [userStatsData, prepareBannerData])

const saveNow = useCallback(() => {
	if (timer.current) {
		clearTimeout(timer.current)
	}

	userCalculatorDataPatch(userStatsData, prepareBannerData())
	setTimerIsGoing(false)
}, [userStatsData, prepareBannerData])

	useEffect(() => {
		initialCalculatorDataFetch()
			.then((response) => response.json())
			.then((data: CalculatorData) => {
				const mergedEvents = [
  ...data.banner_timeline_data.map(event => ({ ...event, _source: 'banner' })),
  ...data.champions_meeting_data.map(event => ({ ...event, _source: 'champions' }))
];

const sortedMergedEvents = mergedEvents.sort((a, b) => {
  const timeDiff = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
  
  if (timeDiff !== 0) {
    return timeDiff;
  }

  // Same date → champions comes before banner
  if (a._source === 'champions' && b._source === 'banner') return -1;
  if (a._source === 'banner' && b._source === 'champions') return 1;
  
  return 0; // same source, keep original order
})
				
				setUserStatsData(data.user_stats_data)
				setClubRankData(data.club_rank_data)
				setTeamTrialsRankData(data.team_trials_rank_data)
				setChampionsMeetingRankData(data.champions_meeting_rank_data)
				setUmaBannerData(data.banner_uma_data)
				setSupportBannerData(data.banner_support_data)
				setUserPlannedBannerData(data.user_planned_banner_data)
				setEventRewardsData(data.event_rewards_data)
				setChampionsMeetingData(data.champions_meeting_data)
				setOrganizedTimelineData(sortedMergedEvents)
			})
			.catch((error) => console.error("Error fetching calculator data:", error))
	}, [])

	useEffect(() => {
		startTimer()

		return () => {
			if (timer.current) {
				clearTimeout(timer.current)
			}
		}
	}, [startTimer])

	const value = {
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		umaBannerData,
		supportBannerData,
		userPlannedBannerData,
		eventRewardsData,
		championsMeetingData,
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

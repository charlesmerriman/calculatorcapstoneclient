import React, { useEffect, useState } from "react"
import { CalculatorContext } from "./CalculatorContext"
import type {
	CalculatorData,
	UserStats,
	Banner,
	ClubRank,
	TeamTrailsRank,
	ChampionsMeetingRank,
	UserPlannedBanner,
	BannerTag
} from "./calculatorTypes"

type CalculatorProviderProps = {
	children: React.ReactNode
}

export const CalculatorProvider = ({ children }: CalculatorProviderProps) => {
	const [data, setData] = useState<CalculatorData | null>(null)
	const [userStatsData, setUserStatsData] = useState<UserStats | null>(null)
	const [clubRankData, setClubRankData] = useState<ClubRank[] | null>(null)
	const [teamTrialsRankData, setTeamTrialsRankData] = useState<
		TeamTrailsRank[] | null
	>(null)
	const [championsMeetingRankData, setChampionsMeetingRankData] = useState<
		ChampionsMeetingRank[] | null
	>(null)
	const [umaBannerData, setUmaBannerData] = useState<Banner[] | null>(null)
	const [supportBannerData, setSupportBannerData] = useState<Banner[] | null>(
		null
	)
	const [userPlannedBannerData, setUserPlannedBannerData] = useState<
		UserPlannedBanner[] | null
	>(null)
	const [bannerTagData, setBannerTagData] = useState<BannerTag[] | null>(null)
	const [bannerTypeData, setBannerTypeData] = useState<BannerTag[] | null>(null)
	const [currentCarats, setCurrentCarats] = useState<number>(0)

	useEffect(() => {
		fetch("http://localhost:8000/calculator-data", {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Token ${localStorage.getItem("authToken")}`
			}
		})
			.then((response) => response.json())
			.then((data: CalculatorData) => {
				setData(data)
				setUserStatsData(data.user_stats_data)
				setClubRankData(data.club_rank_data)
				setTeamTrialsRankData(data.team_trials_rank_data)
				setChampionsMeetingRankData(data.champions_meeting_rank_data)
				setUmaBannerData(
					data.banner_data.filter((banner) => banner.banner_type.id === 1)
				)
				setSupportBannerData(
					data.banner_data.filter((banner) => banner.banner_type.id === 2)
				)
				setUserPlannedBannerData(data.user_planned_banner_data)
				setCurrentCarats(data.user_stats_data.current_carat)
				setBannerTagData(data.banner_tag_data)
				setBannerTypeData(data.banner_type_data)
			})
			.catch((error) => console.error("Error fetching calculator data:", error))
	}, [])

	const value = {
		data,
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		umaBannerData,
		supportBannerData,
		userPlannedBannerData,
		currentCarats,
		bannerTagData,
		bannerTypeData,
		setCurrentCarats,
		setUserPlannedBannerData
	}

	return (
		<CalculatorContext.Provider value={value}>
			{children}
		</CalculatorContext.Provider>
	)
}

// TODO: Add a loading state, error state, check if token is not null first before call, add token as dependency in useEffect, create functions that update backend shortly after user has not made changes for a while

// TODO: Add a plan to spend state as to affect different components, tracked by end date

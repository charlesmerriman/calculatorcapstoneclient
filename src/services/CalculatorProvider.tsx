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
	const [userStatsData, setUserStatsData] = useState<UserStats | null>(null)
	const [clubRankData, setClubRankData] = useState<ClubRank[] | []>([])
	const [teamTrialsRankData, setTeamTrialsRankData] = useState<
		TeamTrailsRank[] | []
	>([])
	const [championsMeetingRankData, setChampionsMeetingRankData] = useState<
		ChampionsMeetingRank[] | []
	>([])
	const [umaBannerData, setUmaBannerData] = useState<Banner[] | []>([])
	const [supportBannerData, setSupportBannerData] = useState<Banner[] | []>([])
	const [userPlannedBannerData, setUserPlannedBannerData] = useState<
		UserPlannedBanner[] | []
	>([])
	const [bannerTagData, setBannerTagData] = useState<BannerTag[] | []>([])
	const [bannerTypeData, setBannerTypeData] = useState<BannerTag[] | []>([])

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
				setBannerTagData(data.banner_tag_data)
				setBannerTypeData(data.banner_type_data)
			})
			.catch((error) => console.error("Error fetching calculator data:", error))
	}, [])

	useEffect(() => {
		const timer = setTimeout(() => {
			const userPlannedBannerDataCopy = userPlannedBannerData?.map(
				(plannedBanner) => {
					if (plannedBanner.tempId) {
						// eslint-disable-next-line @typescript-eslint/no-unused-vars
						const { tempId, ...rest } = plannedBanner
						return { ...rest }
					} else return plannedBanner
				}
			)

			fetch("http://localhost:8000/calculator-data", {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Token ${localStorage.getItem("authToken")}`
				},
				body: JSON.stringify({
					user_stats_data: userStatsData,
					user_planned_banner_data: userPlannedBannerDataCopy
				})
			})
		}, 5000)

		return () => clearTimeout(timer)
	}, [userStatsData, userPlannedBannerData])

	const value = {
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		umaBannerData,
		supportBannerData,
		userPlannedBannerData,
		bannerTagData,
		bannerTypeData,
		setUserPlannedBannerData,
		setUserStatsData
	}

	return (
		<CalculatorContext.Provider value={value}>
			{children}
		</CalculatorContext.Provider>
	)
}

// TODO: Add a loading state, error state, check if token is not null first before call, add token as dependency in useEffect, create functions that update backend shortly after user has not made changes for a while

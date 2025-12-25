import Select from "react-select"
import { useCalculatorData } from "../../services/CalculatorContext"

export const IncomeForm = () => {
	const {
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		currentCarats,
		setUserStatsData,
		setCurrentCarats
	} = useCalculatorData()

	if (!userStatsData) {
		return <div>Loading...</div>
	}

	const teamTrialsRank = teamTrialsRankData?.find(
		(rank) => rank.id === userStatsData.team_trials_rank
	)
	const clubRank = clubRankData?.find(
		(rank) => rank.id === userStatsData.club_rank
	)
	const championsMeetingRank = championsMeetingRankData?.find(
		(rank) => rank.id === userStatsData.champions_meeting_rank
	)

	return (
		<div className="border m-4">
			<div>
				Current Carats:
				<input
					type="number"
					value={userStatsData.current_carat}
					min={0}
					onChange={(e) => {
						const newCaratCount = Number(e.target.value)
						const userStatsDataCopy = { ...userStatsData }
						userStatsDataCopy.current_carat = newCaratCount
						setUserStatsData(userStatsDataCopy)
					}}
				/>
			</div>
			<div>
				Club Rank:
				<Select
					defaultValue={
						clubRank
							? {
									value: clubRank,
									label: clubRank.name
							  }
							: "Select a rank"
					}
					onChange={(selectedOption) => {
						const userStatsDataCopy = { ...userStatsData }
						userStatsDataCopy.club_rank = selectedOption.value.id
						setUserStatsData(userStatsDataCopy)
					}}
					options={clubRankData?.map((rank) => {
						return {
							value: rank,
							label: rank.name,
							key: rank.id
						}
					})}
				/>
			</div>
			<div>
				Team Trials Rank:
				<Select
					defaultValue={
						teamTrialsRank
							? {
									value: teamTrialsRank,
									label: teamTrialsRank.name
							  }
							: "Select a rank"
					}
					onChange={(selectedOption) => {
						const userStatsDataCopy = { ...userStatsData }
						userStatsDataCopy.team_trials_rank = selectedOption.value.id
						setUserStatsData(userStatsDataCopy)
					}}
					options={teamTrialsRankData?.map((rank) => {
						return {
							value: rank,
							label: rank.name,
							key: rank.id
						}
					})}
				/>
			</div>
			<div>
				Champion's Meeting:
				<Select
					defaultValue={
						championsMeetingRank
							? {
									value: championsMeetingRank,
									label: championsMeetingRank.name
							  }
							: "Select a rank"
					}
					onChange={(selectedOption) => {
						const userStatsDataCopy = { ...userStatsData }
						userStatsDataCopy.champions_meeting_rank = selectedOption.value.id
						setUserStatsData(userStatsDataCopy)
					}}
					options={championsMeetingRankData?.map((rank) => {
						return {
							value: rank,
							label: rank.name,
							key: rank.id
						}
					})}
				/>
			</div>
			<div>
				Daily Carat Pack?:
				<Select
					defaultValue={
						userStatsData
							? userStatsData.daily_carat
								? { value: { daily_carat: true }, label: "Yes" }
								: { value: { daily_carat: false }, label: "No" }
							: null
					}
					onChange={(selectedOption) => {
						const userStatsDataCopy = { ...userStatsData }
						userStatsDataCopy.daily_carat = selectedOption.value.daily_carat
						setUserStatsData(userStatsDataCopy)
					}}
					options={[
						{
							value: { daily_carat: true },
							label: "Yes"
						},
						{
							value: { daily_carat: false },
							label: "No"
						}
					]}
				/>
			</div>
		</div>
	)
}

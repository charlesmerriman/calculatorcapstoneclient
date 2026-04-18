import Select from "react-select"
import type { SingleValue } from "react-select"
import { useCalculatorData } from "../../services/CalculatorContext"
import { darkTextStyles } from "../../utils/reactSelectStyles"
import type { ClubRank, TeamTrialsRank, ChampionsMeetingRank } from "../../types"

interface RankOption<T> {
	value: T
	label: string
	key: number
}

interface DailyCaratOption {
	value: { daily_carat: boolean }
	label: string
}

export const IncomeForm = () => {
	const {
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		setUserStatsData
	} = useCalculatorData()

	if (!userStatsData) {
		return <div>Loading...</div>
	}

	const teamTrialsRank = teamTrialsRankData.find(
		(rank) => rank.id === userStatsData.team_trials_rank
	)
	const clubRank = clubRankData.find(
		(rank) => rank.id === userStatsData.club_rank
	)
	const championsMeetingRank = championsMeetingRankData.find(
		(rank) => rank.id === userStatsData.champions_meeting_rank
	)

	const handleTeamTrialsChange = (option: SingleValue<RankOption<TeamTrialsRank>>): void => {
		if (!option) return
		setUserStatsData({ ...userStatsData, team_trials_rank: option.value.id })
	}

	const handleClubRankChange = (option: SingleValue<RankOption<ClubRank>>): void => {
		if (!option) return
		setUserStatsData({ ...userStatsData, club_rank: option.value.id })
	}

	const handleChampionsMeetingChange = (option: SingleValue<RankOption<ChampionsMeetingRank>>): void => {
		if (!option) return
		setUserStatsData({ ...userStatsData, champions_meeting_rank: option.value.id })
	}

	const handleDailyCaratChange = (option: SingleValue<DailyCaratOption>): void => {
		if (!option) return
		setUserStatsData({ ...userStatsData, daily_carat: option.value.daily_carat })
	}

	const updateField = (field: string, value: number): void => {
		setUserStatsData({ ...userStatsData, [field]: value })
	}

	return (
		<div className="flex justify-center sticky top-15.5 z-100">
			<div className="card-panel p-2 w-full lg:w-7/10 self-center">
				<div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] items-center">
					{/* Currency inputs column */}
					<div className="grid grid-cols-1 content-evenly h-full">
						<div className="form-row-currency">
							<div className="label-income">Current Carats:</div>
							<div>
								<input
									className="input-currency"
									type="number"
									value={userStatsData.current_carat}
									min={0}
									onChange={(e) => updateField("current_carat", Number(e.target.value))}
								/>
							</div>
						</div>
						<div className="form-row-currency">
							<div className="label-income">Uma Tickets:</div>
							<div>
								<input
									className="input-currency"
									type="number"
									value={userStatsData.uma_ticket}
									min={0}
									onChange={(e) => updateField("uma_ticket", Number(e.target.value))}
								/>
							</div>
						</div>
						<div className="form-row-currency">
							<div className="label-income">Support Tickets:</div>
							<div>
								<input
									className="input-currency"
									type="number"
									value={userStatsData.support_ticket}
									min={0}
									onChange={(e) => updateField("support_ticket", Number(e.target.value))}
								/>
							</div>
						</div>
					</div>

					{/* Rank selects column */}
					<div className="grid grid-cols-1 content-evenly h-full">
						<div className="form-row-income">
							<div className="label-income">Team Trials:</div>
							<div className="flex gap-2">
								<Select
									className="flex-1 text-center pr-1"
									styles={darkTextStyles}
									defaultValue={
										teamTrialsRank
											? { value: teamTrialsRank, label: teamTrialsRank.name }
											: null
									}
									placeholder="Select a rank"
									onChange={handleTeamTrialsChange}
									options={teamTrialsRankData.map((rank) => ({
										value: rank, label: rank.name, key: rank.id
									}))}
								/>
							</div>
							<div className="value-display">{teamTrialsRank?.income_amount}</div>
						</div>
						<div className="form-row-income">
							<div className="label-income">Club Rank:</div>
							<div className="flex gap-2">
								<Select
									className="flex-1 text-center pr-1"
									styles={darkTextStyles}
									defaultValue={
										clubRank
											? { value: clubRank, label: clubRank.name }
											: null
									}
									placeholder="Select a rank"
									onChange={handleClubRankChange}
									options={clubRankData.map((rank) => ({
										value: rank, label: rank.name, key: rank.id
									}))}
								/>
							</div>
							<div className="value-display">{clubRank?.income_amount}</div>
						</div>
						<div className="form-row-income">
							<div className="label-income">Champion's Meeting:</div>
							<div className="flex gap-2">
								<Select
									className="flex-1 text-center pr-1"
									styles={darkTextStyles}
									defaultValue={
										championsMeetingRank
											? { value: championsMeetingRank, label: championsMeetingRank.name }
											: null
									}
									placeholder="Select a rank"
									onChange={handleChampionsMeetingChange}
									options={championsMeetingRankData.map((rank) => ({
										value: rank, label: rank.name, key: rank.id
									}))}
								/>
							</div>
							<div className="value-display">{championsMeetingRank?.income_amount}</div>
						</div>
						<div className="form-row-income">
							<div className="label-income">Daily Carat Pack:</div>
							<div className="flex gap-2">
								<Select
									className="flex-1 text-center pr-1"
									styles={darkTextStyles}
									defaultValue={
										userStatsData.daily_carat
											? { value: { daily_carat: true }, label: "Yes" }
											: { value: { daily_carat: false }, label: "No" }
									}
									onChange={handleDailyCaratChange}
									options={[
										{ value: { daily_carat: true }, label: "Yes" },
										{ value: { daily_carat: false }, label: "No" }
									]}
								/>
							</div>
							<div className="value-display">
								{userStatsData.daily_carat ? 2000 : 0}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
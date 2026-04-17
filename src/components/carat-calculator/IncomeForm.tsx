import Select from "react-select"
import type { SingleValue } from "react-select"
import { useCalculatorData } from "../../services/CalculatorContext"
import { darkTextStyles } from "../../utils/reactSelectStyles"
import type { ClubRank, TeamTrialsRank, ChampionsMeetingRank } from "../../types"

/**
 * TYPESCRIPT CONCEPT: Typing Third-Party Library Callbacks
 *
 * react-select's onChange gives you `SingleValue<OptionType>`, which is
 * `OptionType | null` (null when the user clears the selection).
 *
 * We define option types for each Select so TypeScript knows the shape of
 * `selectedOption.value`. Without this, the callback parameter would be
 * implicitly `any` under strict mode, causing a compile error.
 */
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

	/**
	 * TYPESCRIPT CONCEPT: Handling onChange with Null Checks
	 *
	 * Each handler receives `SingleValue<OptionType>` which could be null.
	 * With strict mode, we MUST check for null before accessing .value.
	 * The `if (!option) return` pattern is the cleanest way to handle this.
	 */
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

	return (
		<div className="flex justify-center sticky top-15.5 z-100">
			<div className="bg-neutral-200 rounded-xl border border-gray-200 shadow-sm p-2 w-full lg:w-7/10 self-center">
				<div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] items-center">
					<div className="grid grid-cols-1 content-evenly h-full">
						<div className="grid grid-cols-[30%_40%] lg:grid-cols-[40%_40%] items-center justify-center">
							<div className="text-right text-sm font-medium text-gray-700 pr-3">
								Current Carats:
							</div>
							<div>
								<input
									className="px-2 py-1 w-full border border-green-200 rounded-lg h-9.5 bg-emerald-50 focus:border-green-400 focus:outline-none shadow-sm text-base font-medium text-center"
									type="number"
									value={userStatsData.current_carat}
									min={0}
									onChange={(e) => {
										setUserStatsData({
											...userStatsData,
											current_carat: Number(e.target.value)
										})
									}}
								/>
							</div>
						</div>
						<div className="grid grid-cols-[30%_40%] lg:grid-cols-[40%_40%] items-center justify-center">
							<div className="text-right text-sm font-medium text-gray-700 pr-3">
								Uma Tickets:
							</div>
							<div>
								<input
									className="px-2 py-1 w-full border border-green-200 rounded-lg h-9.5 bg-emerald-50 focus:border-green-400 focus:outline-none shadow-sm text-base font-medium text-center"
									type="number"
									value={userStatsData.uma_ticket}
									min={0}
									onChange={(e) => {
										setUserStatsData({
											...userStatsData,
											uma_ticket: Number(e.target.value)
										})
									}}
								/>
							</div>
						</div>
						<div className="grid grid-cols-[30%_40%] lg:grid-cols-[40%_40%] items-center justify-center">
							<div className="text-right text-sm font-medium text-gray-700 pr-3">
								Support Tickets:
							</div>
							<div>
								<input
									className="px-2 py-1 w-full border border-green-200 rounded-lg h-9.5 bg-emerald-50 focus:border-green-400 focus:outline-none shadow-sm text-base font-medium text-center"
									type="number"
									value={userStatsData.support_ticket}
									min={0}
									onChange={(e) => {
										setUserStatsData({
											...userStatsData,
											support_ticket: Number(e.target.value)
										})
									}}
								/>
							</div>
						</div>
					</div>
					<div className="grid grid-cols-1 content-evenly h-full">
						<div className="grid grid-cols-[1fr_2fr_1fr] md:grid-cols-[1fr_3fr_1fr] items-center justify-between">
							<div className="text-right text-sm font-medium text-gray-700 pr-3">
								Team Trials:
							</div>
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
										value: rank,
										label: rank.name,
										key: rank.id
									}))}
								/>
							</div>
							<div className="border border-[#cccccc] rounded px-2 py-1 text-center text-base font-medium">
								{teamTrialsRank?.income_amount}
							</div>
						</div>
						<div className="grid grid-cols-[1fr_2fr_1fr] md:grid-cols-[1fr_3fr_1fr] items-center justify-between">
							<div className="text-right text-sm font-medium text-gray-700 pr-3">
								Club Rank:
							</div>
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
										value: rank,
										label: rank.name,
										key: rank.id
									}))}
								/>
							</div>
							<div className="border border-[#cccccc] px-2 py-1 text-center text-base font-medium">
								{clubRank?.income_amount}
							</div>
						</div>
						<div className="grid grid-cols-[1fr_2fr_1fr] md:grid-cols-[1fr_3fr_1fr] items-center justify-between">
							<div className="text-right text-sm font-medium text-gray-700 pr-3">
								Champion's Meeting:
							</div>
							<div className="flex gap-2">
								<Select
									className="flex-1 text-center pr-1"
									styles={darkTextStyles}
									defaultValue={
										championsMeetingRank
											? {
													value: championsMeetingRank,
													label: championsMeetingRank.name
											  }
											: null
									}
									placeholder="Select a rank"
									onChange={handleChampionsMeetingChange}
									options={championsMeetingRankData.map((rank) => ({
										value: rank,
										label: rank.name,
										key: rank.id
									}))}
								/>
							</div>
							<div className="border border-[#cccccc] px-2 py-1 text-center text-base font-medium">
								{championsMeetingRank?.income_amount}
							</div>
						</div>
						<div className="grid grid-cols-[1fr_2fr_1fr] md:grid-cols-[1fr_3fr_1fr] items-center justify-between">
							<div className="text-right text-sm font-medium text-gray-700 pr-3">
								Daily Carat Pack:
							</div>
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
							<div className="border border-[#cccccc] px-2 py-1 text-center text-base font-medium">
								{userStatsData.daily_carat ? 2000 : 0}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
import Select from "react-select"
import { useCalculatorData } from "../../services/CalculatorContext"

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

	const teamTrialsRank = teamTrialsRankData?.find(
		(rank) => rank.id === userStatsData.team_trials_rank
	)
	const clubRank = clubRankData?.find(
		(rank) => rank.id === userStatsData.club_rank
	)
	const championsMeetingRank = championsMeetingRankData?.find(
		(rank) => rank.id === userStatsData.champions_meeting_rank
	)

	const customStyles = {
		option: (provided) => ({
			...provided,
			color: "#000"
		})
	}

	return (
		<div className="flex justify-center"><div className="bg-neutral-200 rounded-xl border border-gray-200 shadow-sm p-4 w-full lg:w-7/10 self-center">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
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
									const newCaratCount = Number(e.target.value)
									const userStatsDataCopy = { ...userStatsData }
									userStatsDataCopy.current_carat = newCaratCount
									setUserStatsData(userStatsDataCopy)
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
									const newUmaTicketCount = Number(e.target.value)
									const userStatsDataCopy = { ...userStatsData }
									userStatsDataCopy.uma_ticket = newUmaTicketCount
									setUserStatsData(userStatsDataCopy)
								}}
							/>
						</div>
					</div>{" "}
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
									const newSupportTicketCount = Number(e.target.value)
									const userStatsDataCopy = { ...userStatsData }
									userStatsDataCopy.support_ticket = newSupportTicketCount
									setUserStatsData(userStatsDataCopy)
								}}
							/>
						</div>
					</div>
				</div>
				<div className="grid grid-cols-1 content-evenly h-full">
					<div className="grid grid-cols-[2fr_2fr_1fr] sm:grid-cols-[2fr_3fr_1fr] items-center justify-between">
						<div className="text-right text-sm font-medium text-gray-700 pr-3">
							Team Trials:
						</div>
						<div className="flex gap-2">
							<Select
								className="flex-1 text-center pr-1"
								styles={customStyles}
								defaultValue={
									teamTrialsRank
										? {
												value: teamTrialsRank,
												label: teamTrialsRank.name
										  }
										: null
								}
								placeholder="Select a rank"
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
						<div className="border border-[#cccccc] rounded px-2 py-1 text-center text-base font-medium">
							{teamTrialsRank?.income_amount}
						</div>
					</div>
					<div className="grid grid-cols-[2fr_2fr_1fr] sm:grid-cols-[2fr_3fr_1fr] items-center justify-between">
						<div className="text-right text-sm font-medium text-gray-700 pr-3">
							Club Rank:
						</div>
						<div className="flex gap-2">
							<Select
								className="flex-1 text-center pr-1"
								styles={customStyles}
								defaultValue={
									clubRank
										? {
												value: clubRank,
												label: clubRank.name
										  }
										: null
								}
								placeholder="Select a rank"
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
						</div>{" "}
						<div className="border border-[#cccccc] px-2 py-1 text-center text-base font-medium">
							{clubRank?.income_amount}
						</div>
					</div>

					<div className="grid grid-cols-[2fr_2fr_1fr] sm:grid-cols-[2fr_3fr_1fr] items-center justify-between">
						<div className="text-right text-sm font-medium text-gray-700 pr-3">
							Champion's Meeting:
						</div>
						<div className="flex gap-2">
							<Select
								className="flex-1 text-center pr-1"
								styles={customStyles}
								defaultValue={
									championsMeetingRank
										? {
												value: championsMeetingRank,
												label: championsMeetingRank.name
										  }
										: null
								}
								placeholder="Select a rank"
								onChange={(selectedOption) => {
									const userStatsDataCopy = { ...userStatsData }
									userStatsDataCopy.champions_meeting_rank =
										selectedOption.value.id
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
						</div>{" "}
						<div className="border border-[#cccccc] px-2 py-1 text-center text-base font-medium">
							{championsMeetingRank?.income_amount}
						</div>
					</div>

					<div className="grid grid-cols-[2fr_2fr_1fr] sm:grid-cols-[2fr_3fr_1fr] items-center justify-between">
						<div className="text-right text-sm font-medium text-gray-700 pr-3">
							Daily Carat Pack:
						</div>
						<div className="flex gap-2">
							<Select
								className="flex-1 text-center pr-1"
								styles={customStyles}
								defaultValue={
									userStatsData
										? userStatsData.daily_carat
											? { value: { daily_carat: true }, label: "Yes" }
											: { value: { daily_carat: false }, label: "No" }
										: null
								}
								onChange={(selectedOption) => {
									const userStatsDataCopy = { ...userStatsData }
									userStatsDataCopy.daily_carat =
										selectedOption.value.daily_carat
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
						</div>{" "}
						<div className="border border-[#cccccc] px-2 py-1 text-center text-base font-medium">
							{userStatsData.daily_carat === true ? 2000 : 0}
						</div>
					</div>
				</div>
			</div>
		</div></div>
	)
}

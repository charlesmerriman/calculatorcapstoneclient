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
		<div className="bg-neutral-200 rounded-xl border border-gray-200 shadow-sm p-4">
			<div className="grid grid-cols-[auto_1fr_auto_1fr] gap-4 items-center ">
				{/* Left Column - Current Carats */}
				<div className="text-right text-sm font-medium text-gray-700">
					Current Carats:
				</div>
				<div>
					<input
						className="px-2 py-1 w-full border border-[#cccccc] rounded h-9.5 bg-white"
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

				{/* Right Column - Team Trials */}
				<div className="text-right text-sm font-medium text-gray-700">
					Team Trials:
				</div>
				<div className="flex gap-2">
					<Select
						className="flex-1"
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
					<div className="border border-[#cccccc] rounded px-2 py-1 min-w-25 text-center">
						Income Display
					</div>
				</div>

				{/* Left Column - Uma Tickets */}
				<div className="text-right text-sm font-medium text-gray-700">
					Uma Tickets:
				</div>
				<div>
					<input
						className="px-2 py-1 w-full border border-[#cccccc] rounded h-9.5 bg-white"
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

				{/* Right Column - Club Rank */}
				<div className="text-right text-sm font-medium text-gray-700">
					Club Rank:
				</div>
				<div className="flex gap-2">
					<Select
						className="flex-1"
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
					<div className="border border-[#cccccc] px-2 py-1 min-w-2 text-center">
						Income Display
					</div>
				</div>

				{/* Left Column - Support Tickets */}
				<div className="text-right text-sm font-medium text-gray-700">
					Support Tickets:
				</div>
				<div>
					<input
						className="px-2 py-1 w-full border border-[#cccccc] rounded h-9.5 bg-white"
						type="number"
						value={userStatsData.support_ticket}
						min={0}
						onChange={(e) => {
							const newSupportTicketCount = Number(e.target.value)
							const userStatsDataCopy = { ...userStatsData }
							userStatsDataCopy.uma_ticket = newSupportTicketCount
							setUserStatsData(userStatsDataCopy)
						}}
					/>
				</div>

				{/* Right Column - Champion's Meeting */}
				<div className="text-right text-sm font-medium text-gray-700">
					Champion's Meeting:
				</div>
				<div className="flex gap-2">
					<Select
						className="flex-1"
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
					<div className="border border-[#cccccc] px-2 py-1 min-w-25 text-center">
						Income Display
					</div>
				</div>

				{/* Empty cell for alignment */}
				<div></div>
				<div></div>

				{/* Right Column - Daily Carat Pack */}
				<div className="text-right text-sm font-medium text-gray-700">
					Daily Carat Pack:
				</div>
				<div className="flex gap-2">
					<Select
						className="flex-1"
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
					<div className="border border-[#cccccc] px-2 py-1 min-w-25 text-center">
						Income Display
					</div>
				</div>
			</div>
		</div>
	)
}

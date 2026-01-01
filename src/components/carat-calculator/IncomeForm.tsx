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
		<div className="border m-4 p-4">
			<div className="grid grid-cols-[auto_1fr_auto_1fr] gap-4 items-center ">
				{/* Left Column - Current Carats */}
				<div className="text-right">Current Carats:</div>
				<div>
					<input
						className="border px-2 py-1 w-full"
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
				<div className="text-right">Team Trials:</div>
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
					<div className="border px-2 py-1 min-w-25 text-center">
						Income Display
					</div>
				</div>

				{/* Left Column - Uma Tickets */}
				<div className="text-right">Uma Tickets:</div>
				<div>
					<input
						className="border px-2 py-1 w-full"
						type="number"
						placeholder="Input"
						min={0}
					/>
				</div>

				{/* Right Column - Club Rank */}
				<div className="text-right">Club Rank:</div>
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
					<div className="border px-2 py-1 min-w-2 text-center">
						Income Display
					</div>
				</div>

				{/* Left Column - Support Tickets */}
				<div className="text-right">Support Tickets:</div>
				<div>
					<input
						className="border px-2 py-1 w-full"
						type="number"
						placeholder="Input"
						min={0}
					/>
				</div>

				{/* Right Column - Champion's Meeting */}
				<div className="text-right">Champion's Meeting:</div>
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
							userStatsDataCopy.champions5_meeting_rank =
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
					<div className="border px-2 py-1 min-w-25 text-center">
						Income Display
					</div>
				</div>

				{/* Empty cell for alignment */}
				<div></div>
				<div></div>

				{/* Right Column - Daily Carat Pack */}
				<div className="text-right">Daily Carat Pack:</div>
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
					<div className="border px-2 py-1 min-w-[100px] text-center">
						Income Display
					</div>
				</div>
			</div>
		</div>
	)
}

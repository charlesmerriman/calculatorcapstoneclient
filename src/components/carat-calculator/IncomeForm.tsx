import type { ReactNode } from "react"
import Select from "react-select"
import type { SingleValue, CSSObjectWithLabel, StylesConfig } from "react-select"
import { Trophy, Gift, Diamond, TrendingUp, Sword, Users, Crown, Flame, Gem, Dumbbell, Ticket, Star, Sparkles } from "lucide-react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { useAverageMonthlyIncome } from "../../hooks/useAverageMonthlyIncome"
import type { ClubRank, TeamTrialsRank, ChampionsMeetingRank, LeagueOfHeroesRank } from "../../types"

// ── Types ─────────────────────────────────────────────────────────────

interface RankOption<T> {
	value: T
	label: string
	key: number
}

// ── Shared Styles ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const selectStyles: StylesConfig<any, false> = {
	control: (base: CSSObjectWithLabel) => ({
		...base,
		border: "1px solid #3c3c46",
		borderRadius: 4,
		boxShadow: "none",
		minHeight: 32,
		backgroundColor: "#27272f",
		"&:hover": { borderColor: "#606068" },
	}),
	valueContainer: (base: CSSObjectWithLabel) => ({ ...base, padding: "0 6px" }),
	dropdownIndicator: (base: CSSObjectWithLabel) => ({ ...base, padding: "0 4px", color: "#8e8e9a" }),
	indicatorSeparator: () => ({ display: "none" }),
	menu: (base: CSSObjectWithLabel) => ({ ...base, zIndex: 100, borderRadius: 4, backgroundColor: "#27272f", border: "1px solid #3c3c46" }),
	option: (base: CSSObjectWithLabel, state: { isSelected: boolean; isFocused: boolean }) => ({
		...base,
		color: "#f9fafb",
		backgroundColor: state.isSelected ? "#3c3c46" : state.isFocused ? "#3c3c46" : "#27272f",
		padding: "4px 8px",
	}),
	singleValue: (base: CSSObjectWithLabel) => ({ ...base, color: "#f9fafb" }),
	input: (base: CSSObjectWithLabel) => ({ ...base, color: "#f9fafb" }),
	placeholder: (base: CSSObjectWithLabel) => ({ ...base, color: "#8e8e9a" }),
	menuPortal: (base: CSSObjectWithLabel) => ({ ...base, zIndex: 9999 }),
}

const numInputClass =
	"spin-arrows w-20 border border-gray-600 rounded py-1 pl-4.5 pr-2 text-sm text-center bg-gray-700 text-gray-100 outline-none focus:border-gray-500"

// ── ResourceRow ───────────────────────────────────────────────────────

const ResourceRow = ({
	icon,
	label,
	value,
	onChange,
}: {
	icon: ReactNode
	label: string
	value: number
	onChange: (v: number) => void
}) => (
	<div className="flex items-center gap-2">
		<span className="shrink-0 w-8 h-8 flex items-center justify-center">{icon}</span>
		<span className="text-sm text-gray-400 flex-1 leading-tight">{label}</span>
		<input
			type="number"
			min={0}
			value={value}
			className={numInputClass}
			onChange={(e) => onChange(Number(e.target.value))}
		/>
	</div>
)

const iconCls = "w-4 h-4 shrink-0 text-brand"

// ── IncomeForm ────────────────────────────────────────────────────────

export const IncomeForm = () => {
	const {
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		eventRewardsData,
		championsMeetingData,
		leagueOfHeroesData,
		setUserStatsData,
	} = useCalculatorData()

	const monthlyStats = useAverageMonthlyIncome({
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		eventRewardsData,
		championsMeetingData,
		leagueOfHeroesData,
	})

	if (!userStatsData) return null

	const teamTrialsRank = teamTrialsRankData.find((r) => r.id === userStatsData.team_trials_rank)
	const clubRank = clubRankData.find((r) => r.id === userStatsData.club_rank)
	const championsMeetingRank = championsMeetingRankData.find(
		(r) => r.id === userStatsData.champions_meeting_rank,
	)
	const leagueOfHeroesRank = leagueOfHeroesRankData.find(
		(r) => r.id === userStatsData.league_of_heroes_rank,
	)

	const monthlyItems = [
		{ label: "Monthly Carats", value: monthlyStats.carats, icon: <Gem className={iconCls} /> },
		{ label: "Monthly Uma Tickets", value: monthlyStats.umaTickets, icon: <Ticket className={iconCls} /> },
		{ label: "Monthly Support Tickets", value: monthlyStats.supportTickets, icon: <Ticket className={iconCls} /> },
		{ label: "Monthly SSR Shards", value: monthlyStats.ssrShards, icon: <Star className={iconCls} /> },
		{ label: "Monthly SR Shards", value: monthlyStats.srShards, icon: <Sparkles className={iconCls} /> },
	]

	return (
		<div className="w-full bg-gray-900 px-4 py-3">
			<div className="max-w-7xl mx-auto space-y-4">

				{/* ── Top row: Income Sources + Current Resources ── */}
				<div className="grid grid-cols-[2fr_1fr] gap-4">

					{/* Income Sources outer card */}
					<div className="card-panel p-4">
						<h2 className="font-bold text-brand text-base mb-4 flex items-center gap-2">
							<Trophy className={iconCls} />
							Income Sources
						</h2>
						<div className="border border-gray-700 rounded-xl p-4 grid grid-cols-[3fr_auto_2fr] gap-4">

							{/* Competitive Progress */}
							<div>
								<h3 className="font-semibold text-center text-sm text-brand mb-4 flex items-center justify-center gap-1.5">
									<Trophy className={iconCls} />
									Competitive Progress
								</h3>
								<div className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-x-2 gap-y-3">
									<Sword className={iconCls} />
									<span className="text-sm text-gray-400 text-right pr-2 leading-tight whitespace-nowrap">Team Trials:</span>
									<Select
										styles={selectStyles}
										menuPortalTarget={document.body}
										defaultValue={
											teamTrialsRank
												? { value: teamTrialsRank, label: teamTrialsRank.name, key: teamTrialsRank.id }
												: null
										}
										onChange={(o: SingleValue<RankOption<TeamTrialsRank>>) => {
											if (!o) return
											setUserStatsData({ ...userStatsData, team_trials_rank: o.value.id })
										}}
										options={teamTrialsRankData.map((r) => ({ value: r, label: r.name, key: r.id }))}
									/>
									<div className="w-20">
										{teamTrialsRank && (
											<div className="w-full h-8 flex items-center justify-center text-xs font-semibold text-brand bg-gray-700 border border-brand rounded">
												{`+${teamTrialsRank.income_amount.toLocaleString()}/mo`}
											</div>
										)}
									</div>

									<Users className={iconCls} />
									<span className="text-sm text-gray-400 text-right pr-2 leading-tight whitespace-nowrap">Club Rank:</span>
									<Select
										styles={selectStyles}
										menuPortalTarget={document.body}
										defaultValue={
											clubRank
												? { value: clubRank, label: clubRank.name, key: clubRank.id }
												: null
										}
										onChange={(o: SingleValue<RankOption<ClubRank>>) => {
											if (!o) return
											setUserStatsData({ ...userStatsData, club_rank: o.value.id })
										}}
										options={clubRankData.map((r) => ({ value: r, label: r.name, key: r.id }))}
									/>
									<div className="w-20">
										{clubRank && (
											<div className="w-full h-8 flex items-center justify-center text-xs font-semibold text-brand bg-gray-700 border border-brand rounded">
												{`+${clubRank.income_amount.toLocaleString()}/mo`}
											</div>
										)}
									</div>

									<Crown className={iconCls} />
									<span className="text-sm text-gray-400 text-right pr-2 leading-tight whitespace-nowrap">Champion's Meeting:</span>
									<Select
										styles={selectStyles}
										menuPortalTarget={document.body}
										defaultValue={
											championsMeetingRank
												? {
														value: championsMeetingRank,
														label: championsMeetingRank.name,
														key: championsMeetingRank.id,
													}
												: null
										}
										onChange={(o: SingleValue<RankOption<ChampionsMeetingRank>>) => {
											if (!o) return
											setUserStatsData({ ...userStatsData, champions_meeting_rank: o.value.id })
										}}
										options={championsMeetingRankData.map((r) => ({
											value: r,
											label: r.name,
											key: r.id,
										}))}
									/>
									<div className="w-20">
										{championsMeetingRank && (
											<div className="w-full h-8 flex items-center justify-center text-xs font-semibold text-brand bg-gray-700 border border-brand rounded">
												{`+${championsMeetingRank.income_amount.toLocaleString()}/event`}
											</div>
										)}
									</div>

									<Flame className={iconCls} />
									<span className="text-sm text-gray-400 text-right pr-2 leading-tight whitespace-nowrap">League of Heroes:</span>
									<Select
										styles={selectStyles}
										menuPortalTarget={document.body}
										defaultValue={
											leagueOfHeroesRank
												? {
														value: leagueOfHeroesRank,
														label: leagueOfHeroesRank.name,
														key: leagueOfHeroesRank.id,
													}
												: null
										}
										onChange={(o: SingleValue<RankOption<LeagueOfHeroesRank>>) => {
											if (!o) return
											setUserStatsData({ ...userStatsData, league_of_heroes_rank: o.value.id })
										}}
										options={leagueOfHeroesRankData.map((r) => ({
											value: r,
											label: r.name,
											key: r.id,
										}))}
									/>
									<div className="w-20">
										{leagueOfHeroesRank && (
											<div className="w-full h-8 flex items-center justify-center text-xs font-semibold text-brand bg-gray-700 border border-brand rounded">
												{`+${leagueOfHeroesRank.income_amount.toLocaleString()}/event`}
											</div>
										)}
									</div>
								</div>
							</div>

							{/* Separator */}
							<div className="w-px bg-gray-700 self-stretch my-2" />

							{/* Purchases / Bonuses */}
							<div className="flex flex-col">
								<h3 className="font-semibold text-center text-sm text-brand mb-4 flex items-center justify-center gap-1.5">
									<Gift className={iconCls} />
									Purchases / Bonuses
								</h3>
								<div className="flex-1 flex items-center justify-center">
									<div className="grid grid-cols-[auto_auto_auto_auto] items-center gap-x-4 gap-y-4">
										<Gem className="w-8 h-8 shrink-0 text-brand" />
										<span className="text-sm text-gray-400 text-right leading-tight whitespace-nowrap">Daily Carat Pack:</span>
										<label className="relative inline-flex items-center cursor-pointer">
											<input
												type="checkbox"
												className="sr-only peer"
												checked={userStatsData.daily_carat}
												onChange={(e) =>
													setUserStatsData({ ...userStatsData, daily_carat: e.target.checked })
												}
											/>
											<div className="relative w-10 h-6 rounded-full bg-gray-600 peer-checked:bg-brand after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-4" />
										</label>
										<div className="w-20 h-8 flex items-center justify-center text-xs font-semibold text-brand bg-gray-700 border border-brand rounded">
											{userStatsData.daily_carat ? "+50/day" : "+0/day"}
										</div>

										<Dumbbell className="w-8 h-8 shrink-0 text-brand" />
										<span className="text-sm text-gray-400 text-right leading-tight whitespace-nowrap">Training Pass:</span>
										<label className="relative inline-flex items-center cursor-pointer">
											<input
												type="checkbox"
												className="sr-only peer"
												checked={userStatsData.training_pass}
												onChange={(e) =>
													setUserStatsData({ ...userStatsData, training_pass: e.target.checked })
												}
											/>
											<div className="relative w-10 h-6 rounded-full bg-gray-600 peer-checked:bg-brand after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-4" />
										</label>
										<div className="w-20 h-8 flex items-center justify-center text-xs font-semibold text-brand bg-gray-700 border border-brand rounded">
											{userStatsData.training_pass ? "+2,200/mo" : "+500/mo"}
										</div>
									</div>
								</div>
							</div>

						</div>
					</div>

					{/* Current Resources */}
					<div className="card-panel p-5">
						<h3 className="font-semibold text-center text-sm text-brand mb-4 flex items-center justify-center gap-1.5">
							<Diamond className={iconCls} />
							Current Resources
						</h3>
						<div className="grid grid-cols-2 gap-x-6 gap-y-2">
							<ResourceRow
								icon={<img src="/item_icon_00043.png" alt="Carats" className="w-8 h-8 object-contain" />}
								label="Carats"
								value={userStatsData.current_carat}
								onChange={(v) => setUserStatsData({ ...userStatsData, current_carat: v })}
							/>
							<ResourceRow
								icon={<img src="/item_icon_00144.png" alt="SSR Crystals" className="w-8 h-8 object-contain" />}
								label="SSR Crystals"
								value={userStatsData.ssr_crystals}
								onChange={(v) => setUserStatsData({ ...userStatsData, ssr_crystals: v })}
							/>
							<ResourceRow
								icon={<img src="/item_icon_00043.png" alt="Paid Carats" className="w-8 h-8 object-contain" />}
								label="Paid Carats"
								value={userStatsData.current_paid_carat}
								onChange={(v) => setUserStatsData({ ...userStatsData, current_paid_carat: v })}
							/>
							<ResourceRow
								icon={<img src="/item_icon_00145.png" alt="SR Crystals" className="w-8 h-8 object-contain" />}
								label="SR Crystals"
								value={userStatsData.sr_crystals}
								onChange={(v) => setUserStatsData({ ...userStatsData, sr_crystals: v })}
							/>
							<ResourceRow
								icon={<img src="/item_icon_00041.png" alt="Uma Tickets" className="w-8 h-8 object-contain" />}
								label="Uma Tickets"
								value={userStatsData.uma_ticket}
								onChange={(v) => setUserStatsData({ ...userStatsData, uma_ticket: v })}
							/>
							<ResourceRow
								icon={<img src="/item_icon_00149.png" alt="SSR Shards" className="w-8 h-8 object-contain" />}
								label="SSR Shards"
								value={userStatsData.ssr_shards}
								onChange={(v) => setUserStatsData({ ...userStatsData, ssr_shards: v })}
							/>
							<ResourceRow
								icon={<img src="/item_icon_00111.png" alt="Support Tickets" className="w-8 h-8 object-contain" />}
								label="Support Tickets"
								value={userStatsData.support_ticket}
								onChange={(v) => setUserStatsData({ ...userStatsData, support_ticket: v })}
							/>
							<ResourceRow
								icon={<img src="/item_icon_00150.png" alt="SR Shards" className="w-8 h-8 object-contain" />}
								label="SR Shards"
								value={userStatsData.sr_shards}
								onChange={(v) => setUserStatsData({ ...userStatsData, sr_shards: v })}
							/>
						</div>
					</div>
				</div>

				{/* ── Average Monthly Income ── */}
				<div className="card-panel p-3">
					<h3 className="font-semibold text-sm text-brand mb-3 flex items-center gap-1.5">
						<TrendingUp className={iconCls} />
						Average Monthly Income
					</h3>
					<div className="grid grid-cols-5 gap-3 items-center">
						{monthlyItems.map((item) => (
							<div key={item.label} className="bg-gray-900 border border-gray-700 rounded-xl p-3 flex flex-col items-center gap-1">
								<span className="text-xs text-gray-400 text-center leading-tight">{item.label}</span>
								<div className="relative flex items-center justify-center w-full">
									<span className="absolute left-0 text-brand">{item.icon}</span>
									<span className="text-2xl font-bold text-brand">{item.value.toLocaleString()}</span>
								</div>
							</div>
						))}
					</div>
				</div>

			</div>
		</div>
	)
}

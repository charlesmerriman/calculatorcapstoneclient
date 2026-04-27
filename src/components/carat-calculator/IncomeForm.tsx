import type { ReactNode } from "react"
import Select from "react-select"
import type { SingleValue, CSSObjectWithLabel, StylesConfig } from "react-select"
import { useCalculatorData } from "../../services/CalculatorContext"
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
	"w-20 border border-gray-600 rounded px-2 py-1 text-sm text-right bg-gray-700 text-gray-100 outline-none focus:border-gray-500"

// ── FieldRow ──────────────────────────────────────────────────────────

const FieldRow = ({
	label,
	children,
	badge,
	placeholder: isPlaceholder,
}: {
	label: string
	children: ReactNode
	badge?: string
	placeholder?: boolean
}) => (
	<div className={`grid grid-cols-[auto_1fr_auto] items-center gap-2${isPlaceholder ? " opacity-50" : ""}`}>
		<span className="text-sm text-gray-400 text-right pr-2 leading-tight min-w-25">{label}</span>
		<div>{children}</div>
		<div className="w-20">
			{badge && (
				<div className="w-full h-8 flex items-center justify-center text-xs font-semibold text-brand bg-gray-700 border border-gray-600 rounded">
					{badge}
				</div>
			)}
		</div>
	</div>
)

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
		<span className="shrink-0 w-4 h-4 flex items-center justify-center">{icon}</span>
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

// ── Inline SVG icons ──────────────────────────────────────────────────

const IconTrophy = () => (
	<svg viewBox="0 0 24 24" fill="none" stroke="#E6D28A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
		<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
	</svg>
)

const IconGift = () => (
	<svg viewBox="0 0 24 24" fill="none" stroke="#E6D28A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
		<polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
	</svg>
)

const IconDiamond = () => (
	<svg viewBox="0 0 24 24" fill="none" stroke="#E6D28A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
		<path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z" />
	</svg>
)

const IconChart = () => (
	<svg viewBox="0 0 24 24" fill="none" stroke="#E6D28A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
		<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
	</svg>
)

const IconCarat = () => (
	<svg viewBox="0 0 24 24" fill="none" stroke="#E6D28A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
		<path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z" />
	</svg>
)

const IconTicket = () => (
	<svg viewBox="0 0 24 24" fill="none" stroke="#E6D28A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
		<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
	</svg>
)

const IconCrystal = () => (
	<svg viewBox="0 0 24 24" fill="none" stroke="#E6D28A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
		<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
	</svg>
)

const IconShard = () => (
	<svg viewBox="0 0 24 24" fill="none" stroke="#E6D28A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
		<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
	</svg>
)

// ── IncomeForm ────────────────────────────────────────────────────────

export const IncomeForm = () => {
	const {
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		setUserStatsData,
	} = useCalculatorData()

	if (!userStatsData) return null

	const teamTrialsRank = teamTrialsRankData.find((r) => r.id === userStatsData.team_trials_rank)
	const clubRank = clubRankData.find((r) => r.id === userStatsData.club_rank)
	const championsMeetingRank = championsMeetingRankData.find(
		(r) => r.id === userStatsData.champions_meeting_rank,
	)
	const leagueOfHeroesRank = leagueOfHeroesRankData.find(
		(r) => r.id === userStatsData.league_of_heroes_rank,
	)

	// Placeholder values — calculation logic to be wired up later
	const monthlyStats = {
		carats: 0,
		umaTickets: 0,
		supportTickets: 0,
		ssrShards: 0,
		srShards: 0,
	}

	return (
		<div className="w-full bg-gray-900 px-4 py-3">
			<div className="max-w-7xl mx-auto space-y-4">

				{/* ── Top row: 3 cards ── */}
				<div className="grid grid-cols-3 gap-4">

					{/* Competitive Progress */}
					<div className="card-panel p-5">
						<h3 className="font-semibold text-center text-sm text-gray-200 mb-4 flex items-center justify-center gap-1.5">
							<IconTrophy />
							Competitive Progress
						</h3>
						<div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-3">
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
									<div className="w-full h-8 flex items-center justify-center text-xs font-semibold text-brand bg-gray-700 border border-gray-600 rounded">
										{`+${teamTrialsRank.income_amount.toLocaleString()}/mo`}
									</div>
								)}
							</div>

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
									<div className="w-full h-8 flex items-center justify-center text-xs font-semibold text-brand bg-gray-700 border border-gray-600 rounded">
										{`+${clubRank.income_amount.toLocaleString()}/mo`}
									</div>
								)}
							</div>

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
									<div className="w-full h-8 flex items-center justify-center text-xs font-semibold text-brand bg-gray-700 border border-gray-600 rounded">
										{`+${championsMeetingRank.income_amount.toLocaleString()}/event`}
									</div>
								)}
							</div>

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
									<div className="w-full h-8 flex items-center justify-center text-xs font-semibold text-brand bg-gray-700 border border-gray-600 rounded">
										{`+${leagueOfHeroesRank.income_amount.toLocaleString()}/event`}
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Purchases / Bonuses */}
					<div className="card-panel p-5 flex flex-col">
						<h3 className="font-semibold text-center text-sm text-gray-200 mb-4 flex items-center justify-center gap-1.5">
							<IconGift />
							Purchases / Bonuses
						</h3>
						<div className="flex-1 flex flex-col justify-around">
							<FieldRow label="Daily Carat Pack:" badge="+2,500/mo">
								<div className="flex justify-center">
									<input
										type="checkbox"
										className="toggle toggle-sm toggle-yellow"
										checked={userStatsData.daily_carat}
										onChange={(e) =>
											setUserStatsData({ ...userStatsData, daily_carat: e.target.checked })
										}
									/>
								</div>
							</FieldRow>
							<FieldRow label="Training Pass:" badge="+2,500/mo">
								<div className="flex justify-center">
									<input
										type="checkbox"
										className="toggle toggle-sm toggle-yellow"
										checked={userStatsData.training_pass}
										onChange={(e) =>
											setUserStatsData({ ...userStatsData, training_pass: e.target.checked })
										}
									/>
								</div>
							</FieldRow>
						</div>
					</div>

					{/* Current Resources */}
					<div className="card-panel p-5">
						<h3 className="font-semibold text-center text-sm text-gray-200 mb-4 flex items-center justify-center gap-1.5">
							<IconDiamond />
							Current Resources
						</h3>
						<div className="grid grid-cols-2 gap-x-6 gap-y-2">
							{/* Left sub-column */}
							<ResourceRow
								icon={<IconCarat />}
								label="Carats"
								value={userStatsData.current_carat}
								onChange={(v) => setUserStatsData({ ...userStatsData, current_carat: v })}
							/>
							<ResourceRow
								icon={<IconCrystal />}
								label="SSR Crystals"
								value={userStatsData.ssr_crystals}
								onChange={(v) => setUserStatsData({ ...userStatsData, ssr_crystals: v })}
							/>
							<ResourceRow
								icon={<IconCarat />}
								label="Paid Carats"
								value={userStatsData.current_paid_carat}
								onChange={(v) => setUserStatsData({ ...userStatsData, current_paid_carat: v })}
							/>
							<ResourceRow
								icon={<IconCrystal />}
								label="SR Crystals"
								value={userStatsData.sr_crystals}
								onChange={(v) => setUserStatsData({ ...userStatsData, sr_crystals: v })}
							/>
							<ResourceRow
								icon={<IconTicket />}
								label="Uma Tickets"
								value={userStatsData.uma_ticket}
								onChange={(v) => setUserStatsData({ ...userStatsData, uma_ticket: v })}
							/>
							<ResourceRow
								icon={<IconShard />}
								label="SSR Shards"
								value={userStatsData.ssr_shards}
								onChange={(v) => setUserStatsData({ ...userStatsData, ssr_shards: v })}
							/>
							<ResourceRow
								icon={<IconTicket />}
								label="Support Tickets"
								value={userStatsData.support_ticket}
								onChange={(v) => setUserStatsData({ ...userStatsData, support_ticket: v })}
							/>
							<ResourceRow
								icon={<IconShard />}
								label="SR Shards"
								value={userStatsData.sr_shards}
								onChange={(v) => setUserStatsData({ ...userStatsData, sr_shards: v })}
							/>
						</div>
					</div>
				</div>

				{/* ── Average Monthly Income ── */}
				<div className="card-panel p-5">
					<h3 className="font-semibold text-sm text-gray-200 mb-4 flex items-center gap-1.5">
						<IconChart />
						Average Monthly Income
					</h3>
					<div className="grid grid-cols-5 gap-3">
						{[
							{ label: "Monthly Carats", value: monthlyStats.carats, icon: <IconCarat /> },
							{ label: "Monthly Uma Tickets", value: monthlyStats.umaTickets, icon: <IconTicket /> },
							{ label: "Monthly Support Tickets", value: monthlyStats.supportTickets, icon: <IconTicket /> },
							{ label: "Monthly SSR Shards", value: monthlyStats.ssrShards, icon: <IconShard /> },
							{ label: "Monthly SR Shards", value: monthlyStats.srShards, icon: <IconShard /> },
						].map(({ label, value, icon }) => (
							<div key={label} className="bg-gray-900 border border-gray-700 rounded-xl p-3 flex flex-col items-center gap-1">
								<span className="text-xs text-gray-400 text-center leading-tight">{label}</span>
								<div className="relative flex items-center justify-center w-full">
									<span className="absolute left-0 text-brand">{icon}</span>
									<span className="text-2xl font-bold text-brand">{value.toLocaleString()}</span>
								</div>
							</div>
						))}
					</div>
				</div>

			</div>
		</div>
	)
}

import { useState, type ReactNode } from "react"
import { motion } from "framer-motion"
import Select from "react-select"
import type { SingleValue, CSSObjectWithLabel, StylesConfig } from "react-select"
import { Trophy, Gift, Diamond, TrendingUp, Sword, Users, Crown, Flame, Carrot, Dumbbell, Ticket, Star, Sparkles, ChevronDown } from "lucide-react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { useAverageMonthlyIncome } from "../../hooks/useAverageMonthlyIncome"
import { UncapCrystalsPanel } from "./UncapCrystalsPanel"
import { ToggleSwitch } from "../ToggleSwitch"
import type { ClubRank, TeamTrialsRank, ChampionsMeetingRank, LeagueOfHeroesRank } from "../../types"

// ── Types ─────────────────────────────────────────────────────────────

interface RankOption<T> {
	value: T
	label: string
	key: number
}

// ── Shared Styles ─────────────────────────────────────────────────────

// Colors reference the theme's CSS variables (the same gray tokens the Tailwind
// utilities use) so these rank selects repaint with the active [data-theme]
// instead of being locked to the dark palette. gray-700 = surface, gray-600 =
// border/selected, gray-500 = hover border, gray-400 = indicator/placeholder,
// gray-100 = text.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const selectStyles: StylesConfig<any, false> = {
	control: (base: CSSObjectWithLabel) => ({
		...base,
		border: "1px solid var(--color-gray-600)",
		borderRadius: 4,
		boxShadow: "none",
		minHeight: 32,
		backgroundColor: "var(--color-gray-700)",
		"&:hover": { borderColor: "var(--color-gray-500)" },
	}),
	valueContainer: (base: CSSObjectWithLabel) => ({ ...base, padding: "0 6px" }),
	dropdownIndicator: (base: CSSObjectWithLabel) => ({ ...base, padding: "0 4px", color: "var(--color-gray-400)" }),
	indicatorSeparator: () => ({ display: "none" }),
	menu: (base: CSSObjectWithLabel) => ({ ...base, zIndex: 100, borderRadius: 4, backgroundColor: "var(--color-gray-700)", border: "1px solid var(--color-gray-600)" }),
	option: (base: CSSObjectWithLabel, state: { isSelected: boolean; isFocused: boolean }) => ({
		...base,
		color: "var(--color-gray-100)",
		backgroundColor: state.isSelected || state.isFocused ? "var(--color-gray-600)" : "var(--color-gray-700)",
		padding: "4px 8px",
	}),
	singleValue: (base: CSSObjectWithLabel) => ({ ...base, color: "var(--color-gray-100)" }),
	input: (base: CSSObjectWithLabel) => ({ ...base, color: "var(--color-gray-100)" }),
	placeholder: (base: CSSObjectWithLabel) => ({ ...base, color: "var(--color-gray-400)" }),
	menuPortal: (base: CSSObjectWithLabel) => ({ ...base, zIndex: 9999 }),
}

// Padding is symmetric: the spin arrows are positioned out of flow (see
// .spin-arrows in App.css), so text-center already lands optically centered —
// the old asymmetric pl-4.5 counterweight would now push the value off-center.
const numInputClass =
	"spin-arrows w-20 border border-gray-600 rounded py-1 px-2 text-sm text-center bg-gray-700 text-gray-100 outline-none focus:border-gray-500"

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
	<div className="flex min-w-0 items-center gap-2">
		<span className="shrink-0 w-8 h-8 flex items-center justify-center">{icon}</span>
		<span className="min-w-0 flex-1 text-sm text-gray-400 leading-tight">{label}</span>
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
		gameEventsData,
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
		gameEventsData,
		championsMeetingData,
		leagueOfHeroesData,
	})

	// Open by default on desktop, collapsed on mobile — this panel is roughly a
	// screen and a half tall on a phone, and the banner sheet below it is what
	// most visits are actually for.
	//
	// The breakpoint is read ONCE in the lazy initializer rather than subscribed
	// to with a matchMedia listener: the default is a first-paint concern only.
	// A live listener would re-force open/closed on every crossing of 767px,
	// overriding whatever the user had toggled mid-session.
	const [isOpen, setIsOpen] = useState(() =>
		typeof window !== "undefined"
			? !window.matchMedia("(max-width: 767px)").matches
			: true
	)

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
		{ label: "Carats", value: monthlyStats.carats, icon: <Carrot className={iconCls} /> },
		{ label: "Uma Tickets", value: monthlyStats.umaTickets, icon: <Ticket className={iconCls} /> },
		{ label: "Support Tickets", value: monthlyStats.supportTickets, icon: <Ticket className={iconCls} /> },
		{ label: "SSR Shards", value: monthlyStats.ssrShards, icon: <Star className={iconCls} /> },
		{ label: "SR Shards", value: monthlyStats.srShards, icon: <Sparkles className={iconCls} /> },
	]

	return (
		// No width/background/padding of its own: this renders inside the
		// calculator page's .page-container (max width + bg-gray-900) and its
		// mx-2/sm:mx-4 wrapper, which previously had to be duplicated here
		// because the panel hung full-bleed off the navbar.
		<div className="w-full pt-2">

			{/* Collapse header — a full-width control so it remains an obvious entry
			    point when the income form is closed on phones and desktop alike. */}
			<button
				type="button"
				onClick={() => setIsOpen((v) => !v)}
				aria-expanded={isOpen}
				className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-600 bg-gray-900/40 px-4 py-1.5 text-left transition-colors hover:bg-gray-800/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
			>
				<span className="text-base font-semibold text-brand uppercase tracking-wide">
					Income &amp; Resources
				</span>
				<ChevronDown
					className={`h-5 w-5 shrink-0 text-brand transition-transform ${isOpen ? "rotate-180" : ""}`}
				/>
			</button>

			{/* initial={false} skips the mount animation, so a desktop load paints
			    the panel already open instead of expanding into view. The rank
			    selects portal their menus to document.body, so overflow:hidden
			    here clips the panel without clipping an open dropdown. */}
			<motion.div
				initial={false}
				animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
				transition={{ duration: 0.2, ease: "easeInOut" }}
				style={{ overflow: "hidden" }}
			>
				<div className="space-y-4 pt-2">

				{/* ── Top row: Income Sources + Current Resources ── */}
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">

					{/* Income Sources outer card */}
					<div className="card-panel p-3 sm:p-4">
						<div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_auto_2fr]">

							{/* Competitive Progress */}
							<div className="min-w-0">
								<h3 className="font-semibold text-center text-sm text-brand mb-4 flex items-center justify-center gap-1.5">
									<Trophy className={iconCls} />
									Competitive Progress
								</h3>
								<div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-3 sm:grid-cols-[auto_auto_1fr_auto]">
									<Sword className={iconCls} />
									<span className="text-sm text-gray-400 text-left leading-tight sm:pr-2 sm:text-right sm:whitespace-nowrap">Team Trials:</span>
									<Select
										className="col-span-2 min-w-0 sm:col-span-1"
										styles={selectStyles}
										menuPortalTarget={document.body}
										menuPosition="fixed"
										// Controlled, not defaultValue: userStatsData can be replaced
										// from outside this component (guest→account migration, a save
										// round-trip), and an uncontrolled select would keep showing the
										// rank it mounted with.
										value={
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
									<div className="col-span-2 w-24 justify-self-end sm:col-span-1 sm:w-20">
										{teamTrialsRank && (
											<div className="w-full h-8 flex items-center justify-center text-xs font-semibold text-brand bg-gray-700 border border-brand rounded">
												{`+${teamTrialsRank.income_amount.toLocaleString()}/mo`}
											</div>
										)}
									</div>

									<Users className={iconCls} />
									<span className="text-sm text-gray-400 text-left leading-tight sm:pr-2 sm:text-right sm:whitespace-nowrap">Club Rank:</span>
									<Select
										className="col-span-2 min-w-0 sm:col-span-1"
										styles={selectStyles}
										menuPortalTarget={document.body}
										menuPosition="fixed"
										value={
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
									<div className="col-span-2 w-24 justify-self-end sm:col-span-1 sm:w-20">
										{clubRank && (
											<div className="w-full h-8 flex items-center justify-center text-xs font-semibold text-brand bg-gray-700 border border-brand rounded">
												{`+${clubRank.income_amount.toLocaleString()}/mo`}
											</div>
										)}
									</div>

									<Crown className={iconCls} />
									<span className="text-sm text-gray-400 text-left leading-tight sm:pr-2 sm:text-right sm:whitespace-nowrap">Champion's Meeting:</span>
									<Select
										className="col-span-2 min-w-0 sm:col-span-1"
										styles={selectStyles}
										menuPortalTarget={document.body}
										menuPosition="fixed"
										value={
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
									<div className="col-span-2 w-24 justify-self-end sm:col-span-1 sm:w-20">
										{championsMeetingRank && (
											<div className="w-full h-8 flex items-center justify-center text-xs font-semibold text-brand bg-gray-700 border border-brand rounded">
												{`+${championsMeetingRank.income_amount.toLocaleString()}/event`}
											</div>
										)}
									</div>

									<Flame className={iconCls} />
									<span className="text-sm text-gray-400 text-left leading-tight sm:pr-2 sm:text-right sm:whitespace-nowrap">League of Heroes:</span>
									<Select
										className="col-span-2 min-w-0 sm:col-span-1"
										styles={selectStyles}
										menuPortalTarget={document.body}
										menuPosition="fixed"
										value={
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
									<div className="col-span-2 w-24 justify-self-end sm:col-span-1 sm:w-20">
										{leagueOfHeroesRank && (
											<div className="w-full h-8 flex items-center justify-center text-xs font-semibold text-brand bg-gray-700 border border-brand rounded">
												{`+${leagueOfHeroesRank.income_amount.toLocaleString()}/event`}
											</div>
										)}
									</div>
								</div>
							</div>

							{/* Separator */}
							<div className="hidden w-px bg-gray-700 self-stretch my-2 xl:block" />

							{/* Purchases / Bonuses */}
							<div className="flex min-w-0 flex-col">
								<h3 className="font-semibold text-center text-sm text-brand mb-4 flex items-center justify-center gap-1.5">
									<Gift className={iconCls} />
									Purchases / Bonuses
								</h3>
								<div className="flex-1 flex items-center justify-center">
									<div className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-3 sm:w-auto sm:grid-cols-[auto_auto_auto_auto] sm:gap-x-4 sm:gap-y-4">
										<Carrot className="w-8 h-8 shrink-0 text-brand" />
										<span className="min-w-0 text-sm text-gray-400 text-left leading-tight sm:text-right sm:whitespace-nowrap">Daily Carat Pack:</span>
										<ToggleSwitch
											ariaLabel="Daily Carat Pack"
											checked={userStatsData.daily_carat}
											onChange={(checked) =>
												setUserStatsData({ ...userStatsData, daily_carat: checked })
											}
										/>
										{/* Daily carats only — the pack's 500 paid carats per 30-day
										    repurchase are projected but won't fit the badge, so the
										    tooltip carries them (same pattern as Training Pass below). */}
										<div
											className="col-span-3 h-8 w-24 justify-self-end flex items-center justify-center text-xs font-semibold text-brand bg-gray-700 border border-brand rounded sm:col-span-1 sm:w-20"
											title={
												userStatsData.daily_carat
													? "Daily Carat Pack: +50 carats every day, plus 500 paid carats each time it is re-bought (every 30 days, starting 30 days from today)"
													: "Daily Carat Pack disabled — no daily carats and no paid carats from repurchases"
											}
										>
											{userStatsData.daily_carat ? "+50/day" : "+0/day"}
										</div>

										<Dumbbell className="w-8 h-8 shrink-0 text-brand" />
										<span className="min-w-0 text-sm text-gray-400 text-left leading-tight sm:text-right sm:whitespace-nowrap">Training Pass:</span>
										<ToggleSwitch
											ariaLabel="Training Pass"
											checked={userStatsData.training_pass}
											onChange={(checked) =>
												setUserStatsData({ ...userStatsData, training_pass: checked })
											}
										/>
										{/* Carats only — the pass's ticket income is projected but not
										    shown here, to keep the badge in step with the rows above.
										    The tooltip carries the full breakdown for anyone who wants it. */}
										<div
											className="col-span-3 h-8 w-24 justify-self-end flex items-center justify-center text-xs font-semibold text-brand bg-gray-700 border border-brand rounded sm:col-span-1 sm:w-20"
											title={
												userStatsData.training_pass
													? "Paid Training Pass: +2,200 carats each month (1,850 free carats plus 350 paid carats), 4 uma tickets and 4 support tickets"
													: "Free Training Pass tier: +500 carats, 2 uma tickets and 2 support tickets each month"
											}
										>
											{userStatsData.training_pass ? "+2,200/mo" : "+500/mo"}
										</div>
									</div>
								</div>
							</div>

						</div>
					</div>

					{/* Current Resources */}
					<div className="card-panel p-3 sm:p-5">
						<h3 className="font-semibold text-center text-sm text-brand mb-4 flex items-center justify-center gap-1.5">
							<Diamond className={iconCls} />
							Current Resources
						</h3>
						<div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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

				{/* ── Bottom row: Average Monthly Income + Uncap Crystals ── */}
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">

					<div className="card-panel p-3 flex flex-col">
						<h3 className="font-semibold text-sm text-brand mb-3 flex items-center justify-center gap-1.5">
							<TrendingUp className={iconCls} />
							Average Monthly Income
						</h3>
						<div className="flex-1 grid grid-cols-1 gap-3 items-stretch sm:grid-cols-2 xl:grid-cols-5">
							{monthlyItems.map((item) => (
								<div key={item.label} className="bg-gray-900 border border-gray-700 rounded-xl p-3 flex flex-col items-center justify-center gap-1">
									<span className="text-xs text-gray-400 text-center leading-tight">{item.label}</span>
									<div className="flex w-full items-center justify-center gap-1.5">
										<span className="text-brand">{item.icon}</span>
										<span className="text-xl font-bold text-brand sm:text-2xl">{item.value.toLocaleString()}</span>
									</div>
								</div>
							))}
						</div>
					</div>

					<UncapCrystalsPanel />

				</div>

				</div>
			</motion.div>
		</div>
	)
}

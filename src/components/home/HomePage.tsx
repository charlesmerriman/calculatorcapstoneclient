import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
	ArrowUpRight,
	CalendarPlus,
	Carrot,
	FileText,
	HelpCircle,
	MessageSquare,
	PlayCircle,
	ScrollText,
	Ticket,
	TrendingUp,
	Trophy,
} from "lucide-react"
import { Navbar } from "../navbar/Navbar"
import { Footer } from "../footer/Footer"
import { SupportersSection } from "./SupportersSection"
import { changelogFetch } from "../../services/changelogFetchCalls"
import { formatRelativeDate } from "../../utils/relativeDate"
import { HOMEPAGE_FAQ_IDS, faqItemsByIds } from "../../constants/faqContent"
import type { ChangelogEntry } from "../../types"
import { useDocumentMeta } from "../../hooks/useDocumentMeta"

const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@HenryHandsomeDerby"
const YOUTUBE_UPLOADS_PLAYLIST_ID = "UUbKJl479CjOtg57eF-GhUDw"
// The direct document URL, deliberately NOT umacaratcalculator.com. That domain
// currently 301s here, but it is also the obvious candidate to repoint at this
// site — at which point a vanity link would quietly become a self-link.
const HENRY_SHEET_URL =
	"https://docs.google.com/spreadsheets/d/100t3hnYl5Qm2UR8RtPlH-8Xd9KQbBlxEdXUOIR4d394/"

/**
 * What the projection actually models, grouped the way a player thinks about it
 * rather than the way the ledger is built. This is the page's credibility
 * section: someone deciding whether to trust the forecast wants to know whether
 * their situation is covered before they type anything in.
 */
const COVERAGE = [
	{
		title: "Recurring income",
		body: "Daily login, Team Trials on Mondays, club rank on the 1st, Champions Meeting and League of Heroes on the event's end date.",
	},
	{
		title: "Events & campaigns",
		body: "Game events, login campaigns, seasonal rewards, and anniversary campaigns with their carat packs and selector tickets.",
	},
	{
		title: "What you buy",
		body: "Daily Carat Pack, Training Pass and Monthly Shop Tickets as toggles, with paid carats tracked separately so the daily discount is priced right.",
	},
	{
		title: "How you spend",
		body: "Pity at 200 pulls, free pulls, uma and support tickets, selector tickets, and paid-only step-up banners with their own odds.",
	},
]

const steps = [
	{ icon: Carrot, title: "Enter your resources", body: "Add your current carats and tickets." },
	{ icon: Trophy, title: "Set your ranks", body: "Match the forecast to your income." },
	{ icon: CalendarPlus, title: "Add upcoming banners", body: "Choose the banners you want to plan for." },
	{ icon: Ticket, title: "Set your pull goals", body: "Decide how far you want to pull." },
	{ icon: TrendingUp, title: "Read the forecast", body: "See what will be available by each end date." },
]

// `caption` is the tile's default subtitle. Changelog overrides it below with the live
// "Updated <relative date>" once that has loaded; the rest are static. Carrying the text
// per-link keeps "Coming soon" attached to the one page that is actually still coming,
// rather than falling out of an else-branch onto every non-changelog tile.
const infoLinks = [
	{ to: "/changelog", icon: ScrollText, label: "Changelog", caption: "View updates" },
	{ to: "/faq", icon: HelpCircle, label: "FAQ", caption: "Common questions" },
	{ to: "/feedback", icon: MessageSquare, label: "Feedback", caption: "Report a bug" },
]

export const HomePage = () => {
	useDocumentMeta(null, "Plan your Uma Musume gacha pulls. Forecast how many carats and tickets you will have for any upcoming banner, based on your rank income, events and campaigns.")

	const [latestChangelogDate, setLatestChangelogDate] = useState<string | null>(null)

	useEffect(() => {
		const controller = new AbortController()
		changelogFetch(controller.signal)
			.then((res) => (res.ok ? res.json() : null))
			.then((data: ChangelogEntry[] | null) => {
				if (data?.length) setLatestChangelogDate(data[0].date)
			})
			.catch(() => undefined)
		return () => controller.abort()
	}, [])

	return (
		<div className="home-canvas-shell flex min-h-dvh flex-col bg-gray-900">
			{/* .home-canvas-shell above lines this navbar's wordmark up with the "P"
			    of the hero heading below it — see App.css. */}
			<Navbar />
			{/* Normal block flow rather than the previous `flex items-center`, which
			    vertically centred a single screenful. That centring is what forced the
			    page to explain nothing and to truncate the copy it did have: there was
			    no room below the fold because there was no below the fold. The hero and
			    the two-column band above are unchanged — everything added sits under
			    them, so a returning visitor's first screen looks exactly as it did. */}
			<main className="flex-1">
				<div className="mx-auto w-full max-w-[104rem] px-4 py-5 sm:px-6 lg:px-8 lg:py-4">
					<section className="rounded-2xl border border-gray-700 bg-gray-800/75 px-5 py-4 shadow-lg shadow-black/10 sm:px-6">
						<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
							<div>
								<h1 className="text-2xl font-bold tracking-tight text-gray-100 sm:text-3xl">Plan your pulls. Know your carats.</h1>
								<p className="mt-1 text-sm text-gray-400 sm:text-base">A simple planner for your Uma Musume banners, income, and pull goals.</p>
							</div>
							<div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
								<Link to="/app" className="rounded-lg bg-brand px-4 py-2 text-center text-sm font-bold text-black transition hover:brightness-110">Open the calculator</Link>
								<Link to="/login" className="rounded-lg border border-gray-600 px-4 py-2 text-center text-sm font-semibold text-gray-200 transition hover:border-gray-400 hover:bg-gray-700">Sign in to save a plan</Link>
							</div>
						</div>
					</section>

					<div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-stretch">
						<section className="min-w-0">
							<a href={YOUTUBE_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 transition hover:border-red-500/60 hover:bg-gray-700">
								<span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-100 sm:text-base"><PlayCircle className="h-5 w-5 shrink-0 text-red-500" aria-hidden="true" /><span className="truncate">Henry Handsome Derby's latest video</span></span>
								<ArrowUpRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
							</a>
							<div className="mt-3 aspect-video overflow-hidden rounded-xl border border-gray-700 bg-gray-800 shadow-md">
								<iframe className="h-full w-full" src={`https://www.youtube.com/embed/videoseries?list=${YOUTUBE_UPLOADS_PLAYLIST_ID}`} title="Henry Handsome Derby — latest video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
							</div>
							<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
								<a href={HENRY_SHEET_URL} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-left transition hover:border-gray-500 hover:bg-gray-700">
									<FileText className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" /><span className="min-w-0"><span className="block truncate text-xs font-semibold text-gray-100">Henry's Sheet</span><span className="block truncate text-[11px] text-gray-500">Resource guide</span></span>
								</a>
								{infoLinks.map((item) => {
									const Icon = item.icon
									const caption = item.to === "/changelog" && latestChangelogDate ? `Updated ${formatRelativeDate(latestChangelogDate)}` : item.caption
									return <Link key={item.to} to={item.to} className="flex min-w-0 items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-left transition hover:border-gray-500 hover:bg-gray-700"><Icon className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" /><span className="min-w-0"><span className="block truncate text-xs font-semibold text-gray-100">{item.label}</span><span className="block truncate text-[11px] text-gray-500">{caption}</span></span></Link>
								})}
							</div>
						</section>

						<section className="flex h-full flex-col rounded-xl border border-gray-700 bg-gray-800 p-4 shadow-md">
							<div className="flex items-baseline justify-between gap-3"><div><h2 className="text-lg font-bold text-gray-100">How it works</h2><p className="mt-0.5 text-sm text-gray-400">From your stash to a clear pull plan.</p></div><span className="text-xs font-medium text-brand">5 steps</span></div>
							<ol className="mt-3 flex flex-1 flex-col divide-y divide-gray-700 rounded-lg border border-gray-700 bg-gray-900/40">
								{steps.map((step, index) => {
									const Icon = step.icon
									return <li key={step.title} className="flex flex-1 items-center gap-3 px-3 py-2.5"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">{index + 1}</span><Icon className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" /><div className="min-w-0"><h3 className="text-sm font-semibold text-gray-100">{step.title}</h3><p className="text-xs text-gray-400">{step.body}</p></div></li>
								})}
							</ol>
						</section>
					</div>

					{/* ── Below the fold ────────────────────────────────────────────
					    Everything from here down is for the visitor who did not already
					    know what this is. Someone who did clicks a CTA in the hero and
					    never reaches it. */}

					<section className="mt-10 border-t border-gray-800 pt-8">
						<h2 className="text-xl font-bold text-gray-100">What this is</h2>
						<div className="mt-3 max-w-3xl space-y-3 leading-relaxed text-gray-400">
							<p>
								Uma Musume Pretty Derby is a gacha game: you spend a currency called{" "}
								<span className="font-semibold text-gray-300">carats</span> to pull for
								characters and support cards on banners that run for a week or two and then
								go away. Carats arrive slowly, from dozens of separate sources on their own
								schedules, which makes &quot;can I afford the banner after this one?&quot; a
								genuinely hard question to answer in your head.
							</p>
							<p>
								This is a planner for exactly that question. Tell it what you hold now and
								which income applies to you, add the banners you care about, and it walks
								the calendar forward day by day to show what your wallet looks like on the
								day each one ends, before you commit rather than after.
							</p>
						</div>
					</section>

					<section className="mt-10 border-t border-gray-800 pt-8">
						<h2 className="text-xl font-bold text-gray-100">What the forecast accounts for</h2>
						<p className="mt-2 max-w-3xl text-gray-400">
							Income is added on the day the game actually pays it, not averaged across the
							month, so the projection lines up with real banner end dates.
						</p>
						<div className="mt-5 grid gap-4 sm:grid-cols-2">
							{COVERAGE.map((item) => (
								<div
									key={item.title}
									className="rounded-xl border border-gray-700 bg-gray-800 p-4 shadow-md"
								>
									<h3 className="text-sm font-semibold text-brand">{item.title}</h3>
									<p className="mt-1.5 text-sm leading-relaxed text-gray-400">{item.body}</p>
								</div>
							))}
						</div>
					</section>

					<section className="mt-10 border-t border-gray-800 pt-8">
						<div className="flex flex-wrap items-baseline justify-between gap-3">
							<h2 className="text-xl font-bold text-gray-100">Common questions</h2>
							<Link to="/faq" className="text-sm font-semibold text-brand transition hover:text-brand/75">
								See all questions →
							</Link>
						</div>
						<div className="mt-5 space-y-4">
							{/* Only the first answer paragraph — the teaser is a taste, and the
							    full answer is one click away at its own anchor. */}
							{faqItemsByIds(HOMEPAGE_FAQ_IDS).map((item) => (
								<div
									key={item.id}
									className="rounded-xl border border-gray-700 bg-gray-800 p-4 shadow-md"
								>
									<h3 className="text-sm font-semibold text-gray-100">
										<Link to={`/faq#${item.id}`} className="transition hover:text-brand">
											{item.question}
										</Link>
									</h3>
									<p className="mt-1.5 text-sm leading-relaxed text-gray-400">
										{item.answer[0]}
									</p>
								</div>
							))}
						</div>
					</section>

					{/* Last section on the page: it thanks people rather than explaining
					    anything, so it sits below the pitch and the FAQ teaser. Renders
					    nothing at all until there is somebody to thank. */}
					<SupportersSection />
				</div>
			</main>
			<Footer />
		</div>
	)
}

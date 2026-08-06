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
import { changelogFetch } from "../../services/changelogFetchCalls"
import { formatRelativeDate } from "../../utils/relativeDate"
import type { ChangelogEntry } from "../../types"

const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@HenryHandsomeDerby"
const YOUTUBE_UPLOADS_PLAYLIST_ID = "UUbKJl479CjOtg57eF-GhUDw"
const HENRY_SHEET_URL = "#"

const steps = [
	{ icon: Carrot, title: "Enter your resources", body: "Add your current carats and tickets." },
	{ icon: Trophy, title: "Set your ranks", body: "Match the forecast to your income." },
	{ icon: CalendarPlus, title: "Add upcoming banners", body: "Choose the banners you want to plan for." },
	{ icon: Ticket, title: "Set your pull goals", body: "Decide how far you want to pull." },
	{ icon: TrendingUp, title: "Read the forecast", body: "See what will be available by each end date." },
]

const infoLinks = [
	{ to: "/changelog", icon: ScrollText, label: "Changelog" },
	{ to: "/faq", icon: HelpCircle, label: "FAQ" },
	{ to: "/feedback", icon: MessageSquare, label: "Feedback" },
]

export const HomePage = () => {
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
		<div className="flex min-h-dvh flex-col bg-gray-900">
			<Navbar />
			<main className="flex flex-1 items-center">
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
									const caption = item.to === "/changelog" ? (latestChangelogDate ? `Updated ${formatRelativeDate(latestChangelogDate)}` : "View updates") : "Coming soon"
									return <Link key={item.to} to={item.to} className="flex min-w-0 items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-left transition hover:border-gray-500 hover:bg-gray-700"><Icon className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" /><span className="min-w-0"><span className="block truncate text-xs font-semibold text-gray-100">{item.label}</span><span className="block truncate text-[11px] text-gray-500">{caption}</span></span></Link>
								})}
							</div>
						</section>

						<section className="flex h-full flex-col rounded-xl border border-gray-700 bg-gray-800 p-4 shadow-md">
							<div className="flex items-baseline justify-between gap-3"><div><h2 className="text-lg font-bold text-gray-100">How it works</h2><p className="mt-0.5 text-sm text-gray-400">From your stash to a clear pull plan.</p></div><span className="text-xs font-medium text-brand">5 steps</span></div>
							<ol className="mt-3 flex flex-1 flex-col divide-y divide-gray-700 rounded-lg border border-gray-700 bg-gray-900/40">
								{steps.map((step, index) => {
									const Icon = step.icon
									return <li key={step.title} className="flex flex-1 items-center gap-3 px-3 py-2.5"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">{index + 1}</span><Icon className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" /><div className="min-w-0"><h3 className="text-sm font-semibold text-gray-100">{step.title}</h3><p className="truncate text-xs text-gray-400">{step.body}</p></div></li>
								})}
							</ol>
						</section>
					</div>
				</div>
			</main>
			<Footer />
		</div>
	)
}

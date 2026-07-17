import type React from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
	Gem,
	Trophy,
	CalendarPlus,
	Ticket,
	TrendingUp,
	FileText,
	PlayCircle,
	ScrollText,
	HelpCircle,
	MessageSquare,
	ArrowUpRight,
} from "lucide-react"
import { Navbar } from "../navbar/Navbar"
import { Footer } from "../footer/Footer"

// ---------------------------------------------------------------------------
// Config — edit these in one place.
// ---------------------------------------------------------------------------
const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@HenryHandsomeDerby"
// Uploads playlist = the channel ID with its "UC" prefix swapped for "UU".
// Embedding the uploads playlist always plays the channel's newest video first,
// so this stays current with no YouTube Data API key required.
const YOUTUBE_UPLOADS_PLAYLIST_ID = "UUbKJl479CjOtg57eF-GhUDw"
// TODO(link): replace with Henry Handsome's actual Google Sheet URL.
const HENRY_SHEET_URL = "#"

// Shared style constants keep the sections visually consistent and easy to tweak.
const sectionTitle = "text-2xl font-bold text-gray-100"
const sectionIntro = "mt-2 text-gray-400"
const card = "rounded-xl border border-gray-700 bg-gray-800 p-5 shadow-md"

// Numbered walkthrough of the planner. Mirrors the real flow the `useBannerResources`
// hook expects: resources + income ranks in, pull plan out, projections read back.
const steps = [
	{
		icon: Gem,
		title: "Enter your current resources",
		body: "Start with the carats, tickets, and other resources you have right now.",
	},
	{
		icon: Trophy,
		title: "Set your income ranks",
		body: "Pick your Club, Team Trials, Champions Meeting, and League of Heroes ranks so income is estimated correctly.",
	},
	{
		icon: CalendarPlus,
		title: "Add upcoming banners",
		body: "Choose the uma and support banners you're planning to pull on.",
	},
	{
		icon: Ticket,
		title: "Set pulls per banner",
		body: "Tell the calculator how many pulls you want to spend on each banner.",
	},
	{
		icon: TrendingUp,
		title: "Read your projections",
		body: "See how many carats and tickets you'll have available by each banner's end date.",
	},
]

// The three skeleton pages linked from the creator section.
const infoLinks = [
	{ to: "/changelog", icon: ScrollText, label: "Changelog" },
	{ to: "/faq", icon: HelpCircle, label: "FAQ" },
	{ to: "/feedback", icon: MessageSquare, label: "Feedback" },
]

/** Subtle fade/slide-up on mount — matches the motion used elsewhere in the app. */
const fadeUp = {
	initial: { opacity: 0, y: 16 },
	animate: { opacity: 1, y: 0 },
	transition: { duration: 0.4, ease: "easeOut" },
}

/**
 * Public landing page (route: /).
 *
 * Sections:
 *   A. Hero + CTAs
 *   B. How to use the calculator (numbered steps)
 *   C. Creator's resource guide (Google Doc callout)
 *   D. Featured creator: channel link + auto-latest video embed + skeleton page links
 */
export const HomePage = () => {
	return (
		<div className="flex min-h-dvh flex-col bg-gray-900">
			<Navbar />
			<main className="flex-1 overflow-y-auto">
				<div className="mx-auto max-w-6xl space-y-8 px-4 py-6">
					{/* ---- A. Hero (kept compact so the footer stays visible on desktop) ---- */}
					<motion.section {...fadeUp} className="text-center">
						<h1 className="text-2xl font-bold text-gray-100 sm:text-3xl">
							Uma Musume Carat Calculator
						</h1>
						<p className="mx-auto mt-1 max-w-md text-gray-400">
							Plan your pulls. Know your carats.
						</p>
						<div className="mt-4 flex flex-wrap items-center justify-center gap-3">
							<Link
								to="/app"
								className="rounded-lg bg-brand px-5 py-2 font-semibold text-black transition hover:bg-brand/85"
							>
								Open the Calculator
							</Link>
							<Link
								to="/register"
								className="rounded-lg border border-gray-600 px-5 py-2 font-semibold text-gray-200 transition hover:border-gray-400 hover:bg-gray-800"
							>
								Create an account
							</Link>
						</div>
					</motion.section>

					{/* Two-column split on desktop: Henry's channel/video/sheet/links on the
					    left, how-to on the right. Stacks on mobile. */}
					<div className="grid gap-8 lg:grid-cols-2 lg:items-start">
						{/* ---- Left: channel link + latest video + Google Sheet + skeleton links ---- */}
						<motion.section {...fadeUp}>
							{/* Clickable header linking straight to the channel. */}
							<a
								href={YOUTUBE_CHANNEL_URL}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center justify-between gap-3 rounded-xl border border-gray-700 bg-gray-800 px-5 py-3 shadow-md transition hover:border-red-500/60 hover:bg-gray-700"
							>
								<span className="flex items-center gap-2.5 text-lg font-semibold text-gray-100">
									<PlayCircle className="h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
									Henry Handsome's Youtube Channel
								</span>
								<ArrowUpRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
							</a>

							{/* Auto-latest embed: the uploads playlist opens on the newest upload. */}
							<div className="mt-4 aspect-video w-full overflow-hidden rounded-xl border border-gray-700">
								<iframe
									className="h-full w-full"
									src={`https://www.youtube.com/embed/videoseries?list=${YOUTUBE_UPLOADS_PLAYLIST_ID}`}
									title="Henry Handsome — latest video"
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
									allowFullScreen
								/>
							</div>

							{/* Henry's Google Sheet callout (sits directly below the video). */}
							<div className={`${card} mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between`}>
								<div className="flex items-center gap-4">
									<FileText className="h-8 w-8 shrink-0 text-brand" aria-hidden="true" />
									<h2 className="text-lg font-semibold text-gray-100">Henry's Google Sheet</h2>
								</div>
								<a
									href={HENRY_SHEET_URL}
									target="_blank"
									rel="noopener noreferrer"
									className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-600 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:border-gray-400 hover:bg-gray-700 hover:text-gray-100"
								>
									Open the Sheet
									<ArrowUpRight className="h-4 w-4" aria-hidden="true" />
								</a>
							</div>

							{/* Skeleton page links (pages are still under construction). */}
							<div className="mt-4 grid gap-4 sm:grid-cols-3">
								{infoLinks.map((item) => {
									const Icon = item.icon
									return (
										<Link
											key={item.to}
											to={item.to}
											className={`${card} flex items-center gap-3 transition hover:border-gray-500 hover:bg-gray-700`}
										>
											<Icon className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
											<div>
												<div className="font-semibold text-gray-100">{item.label}</div>
												<div className="text-xs text-gray-500">Coming soon</div>
											</div>
										</Link>
									)
								})}
							</div>
						</motion.section>

						{/* ---- Right: How to use the calculator (single column) ---- */}
						<motion.section {...fadeUp}>
							<h2 className={sectionTitle}>How to use the calculator</h2>
							<p className={sectionIntro}>
								Five quick steps from your current stash to a full pull plan.
							</p>
							<ol className="mt-5 space-y-4">
								{steps.map((step, i) => {
									const Icon = step.icon
									return (
										<li key={step.title} className={`${card} flex gap-4`}>
											{/* Number badge */}
											<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-bold text-brand">
												{i + 1}
											</span>
											<div>
												<div className="flex items-center gap-2">
													<Icon className="h-4 w-4 text-brand" aria-hidden="true" />
													<h3 className="font-semibold text-gray-100">{step.title}</h3>
												</div>
												<p className="mt-1 text-sm leading-relaxed text-gray-400">{step.body}</p>
											</div>
										</li>
									)
								})}
							</ol>
						</motion.section>
					</div>
				</div>
			</main>
			<Footer />
		</div>
	)
}

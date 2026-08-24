import type { ReactNode } from "react"
import { Link } from "react-router-dom"

/**
 * FAQ content for the public /faq page.
 *
 * Static rather than API-backed on purpose. The Changelog is an admin-editable Django
 * model because it changes every release; FAQ answers change rarely and are tied to how
 * the app behaves, so they ship with the deploy that changes that behaviour. The shape
 * below deliberately mirrors what a `FaqEntry` model would serialize to, so promoting
 * this to admin-editable later is a swap of the data source, not a rewrite of the page.
 *
 * `.tsx` rather than `.ts` because several answers carry inline links. Keeping the
 * markup with the prose beats threading a parallel array of link metadata through the
 * component.
 *
 * Source material — keep these in step when the behaviour changes:
 *   frontend/docs/carat-income-explained.md   (income, free/paid split, pull colours)
 *   frontend/docs/state-and-guest-mode.md     (guest mode, auto-save)
 *   CLAUDE.md invariants                      (step-ups, selector eligibility)
 */

const link = "text-brand transition hover:text-brand/75"

export interface FaqItem {
	/**
	 * Stable slug. Used as the React key, as the question's DOM id so a single
	 * question can be deep-linked (`/faq#do-i-need-an-account`), and as the handle
	 * the homepage teaser selects by. Derived from the question text, but stored
	 * rather than computed — rewording a question must not break an existing link.
	 */
	id: string
	/** Rendered as the question heading. Also the accessible label for the answer. */
	question: string
	/** One node per paragraph — an answer that needs two blocks gets two entries. */
	answer: ReactNode[]
}

export interface FaqCategory {
	/** Slug used as the section's DOM id and as the jump-link target. */
	id: string
	title: string
	items: FaqItem[]
}

export const FAQ_CATEGORIES: FaqCategory[] = [
	{
		id: "using-the-calculator",
		title: "Using the calculator",
		items: [
			{
				id: "what-does-this-calculator-actually-do",
				question: "What does this calculator actually do?",
				answer: [
					<>
						It projects how many carats and tickets you will have on the day each banner you
						care about ends. You tell it what you hold today and which income sources apply
						to you, add the banners you are planning for, and it walks forward through the
						calendar adding up everything the game will give you between now and then.
					</>,
					<>
						The point is to answer the question you actually have, "can I afford to go for
						both of these, or do I have to pick one?", before the banner arrives rather
						than after.
					</>,
				],
			},
			{
				id: "do-i-need-an-account",
				question: "Do I need an account?",
				answer: [
					<>
						No. The calculator is fully usable as a guest, with nothing to sign up for. An
						account only adds one thing: saving. As a guest your plan lives in your browser
						for as long as the tab is open and is discarded when you leave.
					</>,
					<>
						If you sign in later, the plan you built as a guest comes with you rather than
						being thrown away.
					</>,
				],
			},
			{
				id: "how-do-i-get-started",
				question: "How do I get started?",
				answer: [
					<>
						Open the calculator and enter your current carats and tickets, then set your
						income ranks so the forecast matches how much you actually earn. Add the banners
						you want to plan for, set how far you intend to pull on each, and read the
						forecast against each banner's end date.
					</>,
				],
			},
			{
				id: "what-is-the-difference-between-free-and",
				question: "What is the difference between free and paid carats?",
				answer: [
					<>
						The calculator keeps two piles. <strong>Free carats</strong> come from almost
						everything (daily login, events, rank and club payouts, campaigns) and buy
						normal pulls at 150 each. <strong>Paid carats</strong> come only from things you
						buy with real money, and can buy either a normal pull at 150 or the discounted
						daily pull at 50.
					</>,
					<>
						The split exists because that once-a-day discount only works with purchased
						carats, so the calculator has to know which of yours are which. If you do not
						buy anything your paid pile stays at zero and the split never affects your
						numbers. The figure shown on a banner card is always the two piles added
						together.
					</>,
				],
			},
			{
				id: "what-do-the-colours-on-the-pulls",
				question: 'What do the colours on the "# Pulls" box mean?',
				answer: [
					<>
						<strong>Bright green</strong> means the number lands exactly on a pity threshold
						(a multiple of 200), so nothing is stranded in a part-finished pity counter.{" "}
						<strong>Faded green</strong> means you can afford it, but some pulls sit past the
						last multiple of 200 and do not contribute a guaranteed copy. Nudge the number up
						to the next multiple of 200 and it brightens.
					</>,
					<>
						<strong>Red</strong> means more pulls than you can pay for. The number is kept
						exactly as you typed it, it just will not be funded. Red wins when both apply,
						because not being able to afford something is the more useful thing to know. A
						banner that has already ended can afford nothing, so anything left on it reads as
						red too.
					</>,
				],
			},
		],
	},
	{
		id: "the-numbers",
		title: "The numbers",
		items: [
			{
				id: "where-do-the-carat-numbers-come-from",
				question: "Where do the carat numbers come from?",
				answer: [
					<>
						From your income sources, added on the days the game actually pays them out
						rather than smeared evenly across the month. Daily login pays every day, Team
						Trials pays weekly on Mondays, club rank pays monthly on the 1st, and Champions
						Meeting and League of Heroes pay on the event's end date. Game events, login
						campaigns and seasonal rewards are added on their own schedules.
					</>,
					<>
						A few sources are toggles because they depend on what you buy or how you play:
						the Daily Carat Pack, the Training Pass, Misc Earnings and Monthly Shop Tickets.
						Turn on the ones that apply to you and leave the rest off.
					</>,
				],
			},
			{
				id: "why-does-this-not-match-what-i",
				question: "Why does this not match what I have in the game?",
				answer: [
					<>
						It is a projection, not a promise. The usual reasons it drifts: your starting
						balance is whatever you typed, and nothing is read from the game, so if that is
						stale everything downstream is off by the same amount. Misc Earnings is a flat
						average rather than your real gifts and career clears. Rank income assumes you
						hold your current rank rather than getting promoted or slipping.
					</>,
					<>
						Dates for unannounced banners are predictions based on the Japanese server's
						schedule, and anything predicted can move. Event income models typical play, so
						clearing an event on day one puts you ahead of the projection and leaving it to
						the last weekend puts you behind.
					</>,
				],
			},
			{
				id: "what-does-average-monthly-income-mean",
				question: 'What does "average monthly income" mean?',
				answer: [
					<>
						It is a single headline figure for how much you earn in a typical month at your
						current settings, useful for sanity-checking whether a plan is realistic at a
						glance. It is deliberately a smoothed average, because the per-banner forecasts are the
						precise numbers, because those land on real dates.
					</>,
					<>
						One deliberate exception: one-off campaign purchases are left out of it. They
						are not recurring income, so folding them in would flatter the average.
					</>,
				],
			},
			{
				id: "how-do-step-up-banners-work-here",
				question: "How do step-up banners work here?",
				answer: [
					<>
						Step-ups are priced and counted differently from normal banners, so they get
						their own row type. You enter <strong>steps</strong>, not pulls. One step is
						worth ten pulls' worth of chances, so reading a step count as a pull count
						understates a plan tenfold.
					</>,
					<>
						A step-up is paid for with <strong>paid carats only</strong>. It never spends
						free carats, tickets, free pulls or the daily discount. Each completed round of
						five steps carries a guarantee, and the ladder clamps at the number of steps
						that actually exist on the banner. Planning past your budget is allowed on
						purpose, because the shortfall is the thing you wanted to find out.
					</>,
				],
			},
			{
				id: "why-can-i-not-use-a-selector",
				question: "Why can I not use a selector ticket on a newer banner?",
				answer: [
					<>
						Selector tickets have a cutoff: they can only take a card that was released on
						or before a certain date. The calculator works that out from each card's
						earliest Japanese release date and compares it to the ticket's cutoff, so a card
						newer than the cutoff is not selectable and a card with no known release date is
						not assumed to qualify.
					</>,
					<>
						A ticket only has to reach <em>one</em> featured card on a banner to be usable
						there, not all of them. Note also that selector tickets are not gacha tickets:
						a selector takes a card outright rather than buying a pull, so it never counts
						toward your pull budget.
					</>,
				],
			},
			{
				id: "how-far-ahead-can-i-plan",
				question: "How far ahead can I plan?",
				answer: [
					<>
						As far as the timeline goes. Banners that have been officially announced carry
						their real dates; further out, dates are predicted from the Japanese server's
						schedule, which historically runs ahead of global. Predicted entries are marked
						as such. They are good enough to plan against, but treat them as likely rather
						than fixed.
					</>,
				],
			},
		],
	},
	{
		id: "account-and-privacy",
		title: "Your account and privacy",
		items: [
			{
				id: "what-do-you-store-about-me",
				question: "What do you store about me?",
				answer: [
					<>
						As little as possible. If you sign in with Google or Discord we receive an
						anonymous account reference and nothing else: no email address, no real name,
						no display name or avatar, and never a password. Your username is randomly
						generated by us. Alongside that we store the planning data you enter, so your
						plan is there when you come back.
					</>,
					<>
						Visits are counted without cookies and without ever storing your IP address. The
						full detail is in the{" "}
						<Link to="/privacy-policy" className={link}>
							Privacy Policy
						</Link>
						.
					</>,
				],
			},
			{
				id: "i-lost-access-to-my-google-or",
				question: "I lost access to my Google or Discord account. Can I get my plan back?",
				answer: [
					<>
						Unfortunately not. Because we hold no email address, there is no password reset
						and no way for us to confirm that an account was yours. That is the deliberate
						trade-off for holding none of your personal data: the same design that means a
						breach here exposes nothing about you also means we cannot vouch for you.
					</>,
					<>
						If it happens, you would need to start a new plan.
					</>,
				],
			},
			{
				id: "is-this-site-affiliated-with-cygames",
				question: "Is this site affiliated with Cygames?",
				answer: [
					<>
						No. This is an unofficial fan-made planning tool with no connection to Cygames
						or Uma Musume Pretty Derby. All game names and assets belong to their owners.
						Nothing here is official, and no projection it produces should be read as a
						statement from the game.
					</>,
				],
			},
		],
	},
	{
		id: "about-the-site",
		title: "About the site",
		items: [
			{
				id: "how-do-i-report-a-bug-or",
				question: "How do I report a bug or suggest a feature?",
				answer: [
					<>
						Email{" "}
						<a href="mailto:Henryhandsomederby@gmail.com" className={link}>
							Henryhandsomederby@gmail.com
						</a>
						. Bug reports are much easier to act on with the specifics: which banner or
						screen, what you expected, and what you saw instead.
					</>,
				],
			},
			{
				id: "how-often-is-the-data-updated",
				question: "How often is the data updated?",
				answer: [
					<>
						Banner and event data is updated as the game announces it, and the underlying
						income figures are corrected whenever they are found to have drifted. Recent
						changes are listed on the{" "}
						<Link to="/changelog" className={link}>
							Changelog
						</Link>
						.
					</>,
				],
			},
		],
	},
]

/**
 * The three questions surfaced as a teaser on the homepage, in display order.
 *
 * Selected by id rather than by position so reordering or adding questions above
 * them cannot silently change what the homepage shows. Chosen to cover the three
 * things a first-time visitor actually wonders: whether they have to sign up,
 * whether they can trust the numbers, and whether this is official.
 */
export const HOMEPAGE_FAQ_IDS = [
	"do-i-need-an-account",
	"why-does-this-not-match-what-i",
	"is-this-site-affiliated-with-cygames",
] as const

/** Flattened lookup — the categories are a display grouping, not an index. */
const ALL_FAQ_ITEMS: FaqItem[] = FAQ_CATEGORIES.flatMap((category) => category.items)

/**
 * Resolve ids to items, preserving the order given and skipping anything that no
 * longer exists. Silently dropping a stale id is deliberate: a mistyped id should
 * cost the homepage one teaser, not crash the page a visitor lands on first.
 */
export function faqItemsByIds(ids: readonly string[]): FaqItem[] {
	return ids
		.map((id) => ALL_FAQ_ITEMS.find((item) => item.id === id))
		.filter((item): item is FaqItem => item !== undefined)
}

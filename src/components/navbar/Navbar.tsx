import { Link, useLocation, useNavigate } from "react-router-dom"
import { CalendarDays, Calculator as CalculatorIcon, LogIn, LogOut, Save, UserRound } from "lucide-react"
import { useCalculatorDataSafe } from "../../services/CalculatorContext"
import { userLogout } from "../../services/userServices"
import { toBannerPayload } from "../../services/calculatorFetchCalls"
import { stashGuestPlan } from "../../services/guestMigration"
import { Wordmark } from "../Wordmark"
import { ThemePicker } from "./ThemePicker"
import { SettingsMenu } from "./SettingsMenu"

export const Navbar = () => {
	const navigate = useNavigate()
	const location = useLocation()
	// null when rendered outside CalculatorProvider (e.g. on the home page)
	const calculatorData = useCalculatorDataSafe()

	const isLoggedIn = !!localStorage.getItem("authToken")

	const handleLogout = async (): Promise<void> => {
		try {
			await userLogout()
		} catch {
			console.error("Logout failed")
		} finally {
			localStorage.removeItem("authToken")
			// Full reload rather than navigate(): we're usually already on
			// /app, so a client-side navigation wouldn't remount the provider
			// and the logged-out user would keep seeing their account data.
			window.location.href = "/app"
		}
	}

	// Guest's path to saving: snapshot the in-memory plan into sessionStorage
	// (the provider unmounts on route change, taking its state with it), then
	// send them to login. The provider migrates the snapshot after login.
	const handleSignInToSave = (): void => {
		if (calculatorData) {
			stashGuestPlan(
				calculatorData.userStatsData,
				toBannerPayload(calculatorData.userPlannedBannerData)
			)
		}
		navigate("/login")
	}

	// Settings gear + theme picker, grouped so every nav cluster renders the same
	// controls. SettingsMenu renders nothing outside app mode (no stats loaded).
	const navControls = (
		<>
			<SettingsMenu />
			<ThemePicker />
		</>
	)

	const isCalculator = location.pathname === "/app"
	const isTimeline = location.pathname === "/app/timeline"

	const timerIsGoing = calculatorData?.timerIsGoing ?? false

	const mobileNavClass = (active: boolean) =>
		`flex min-w-0 items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-xs font-medium transition ${
			active
				? "border-brand text-brand"
				: "border-transparent text-gray-400 hover:text-gray-200"
		}`
	const desktopNavClass = (active: boolean) =>
		`flex items-center gap-1.5 border-b-2 px-5 text-sm transition ${
			active
				? "border-brand text-brand"
				: "border-transparent text-gray-400 hover:text-gray-200"
		}`

	// Shared logo element used in both mobile and desktop navs
	const logo = <Wordmark size="nav" />

	// Guest affordance shown in app mode instead of the save icon + Logout.
	// Passive by design — it never interrupts planning.
	const signInToSaveButton = (
		<button
			onClick={handleSignInToSave}
			aria-label="Sign in to save"
			title="Sign in to save your plan to an account"
			className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-600 rounded text-sm text-gray-300 hover:border-gray-400 hover:bg-gray-700 hover:text-gray-100 transition"
		>
			<LogIn className="w-4 h-4" />
			Sign in to save
		</button>
	)

	// Auth button shown on the right side when outside the app (home mode)
	const authButton = isLoggedIn ? (
		<button
			onClick={handleLogout}
			aria-label="Logout"
			title="Logout"
			className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-600 rounded text-sm text-gray-300 hover:border-gray-400 hover:bg-gray-700 hover:text-gray-100 transition"
		>
			<UserRound className="w-4 h-4" />
			Logout
			<LogOut className="w-4 h-4" />
		</button>
	) : (
		<Link
			to="/login"
			className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-600 rounded text-sm text-gray-300 hover:border-gray-400 hover:bg-gray-700 hover:text-gray-100 transition"
		>
			<LogIn className="w-4 h-4" />
			Login
		</Link>
	)

	return (
		<div className="z-50 shrink-0">
			{/* Mobile nav */}
			<nav className="bg-gray-800 border-b border-gray-600 desktop-nav:hidden">
				<div className="flex h-14 items-center justify-between gap-3 px-3">
					<div className="flex min-w-0 items-center">
						{logo}
					</div>

					<div className="flex shrink-0 items-center gap-1.5">
						{calculatorData ? (
							isLoggedIn ? (
								<>
									<div className="flex h-9 w-9 items-center justify-center">
										{timerIsGoing && (
											<button
												onClick={calculatorData.saveNow}
												aria-label="Save now"
												title="Click to save now"
												className="flex h-9 w-9 items-center justify-center rounded border border-gray-600 text-brand transition hover:border-brand/70 hover:bg-gray-700"
											>
												<Save className="h-4 w-4" />
											</button>
										)}
									</div>
									{navControls}
									<button
										onClick={handleLogout}
										aria-label="Logout"
										title="Logout"
										className="flex h-9 w-9 items-center justify-center rounded border border-gray-600 text-gray-300 transition hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100"
									>
										<LogOut className="h-4 w-4" />
									</button>
								</>
							) : (
								<>
									{navControls}
									{signInToSaveButton}
								</>
							)
						) : (
							authButton
						)}
					</div>
				</div>

				<div className="grid grid-cols-2">
					<Link to="/app" className={mobileNavClass(isCalculator)}>
						<CalculatorIcon className="h-4 w-4 shrink-0" />
						<span className="truncate">Calculator</span>
					</Link>
					<Link to="/app/timeline" className={mobileNavClass(isTimeline)}>
						<CalendarDays className="h-4 w-4 shrink-0" />
						<span className="truncate">Timeline</span>
					</Link>
				</div>
			</nav>

			{/* Desktop nav — always three-column; center links always visible.
			    Switches on desktop-nav rather than md: this layout is already over-full
			    below ~900px (the "Sign in to save" button wraps to 2-3 lines), which
			    is precisely the landscape-phone / portrait-tablet band. */}
			<nav className="hidden grid-cols-[1fr_auto_1fr] items-center px-5 bg-gray-800 border-b border-gray-600 h-14 desktop-nav:grid">
				{/* Left: Branding */}
				<div className="flex items-center">
					{logo}
				</div>

				{/* Center: Nav links */}
				<div className="flex justify-center items-stretch h-full">
					<Link to="/app" className={desktopNavClass(isCalculator)}>
						<CalculatorIcon className="w-4 h-4" />
						Calculator
					</Link>
					<Link to="/app/timeline" className={desktopNavClass(isTimeline)}>
						<CalendarDays className="w-4 h-4" />
						Timeline
					</Link>
				</div>

				{/* Right: Save indicator + Theme Picker + Logout/Login */}
				<div className="flex items-center justify-end gap-3">
					{calculatorData ? (
						isLoggedIn ? (
							<>
								{/* Fixed-width slot keeps the right grid column stable so the center nav links don't shift */}
								<div className="w-9 h-9 flex items-center justify-center">
									{timerIsGoing && (
										<button
											onClick={calculatorData.saveNow}
											className="cursor-pointer hover:opacity-70 transition-opacity"
											title="Click to save now"
										>
											<Save className="h-5 w-5 text-brand" />
										</button>
									)}
								</div>
								{navControls}
								<button
									onClick={handleLogout}
									className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-600 rounded text-sm text-gray-300 hover:border-gray-400 hover:bg-gray-700 hover:text-gray-100 transition"
								>
									<UserRound className="w-4 h-4" />
									Logout
									<LogOut className="w-4 h-4" />
								</button>
							</>
						) : (
							<>
								{navControls}
								{signInToSaveButton}
							</>
						)
					) : (
						<>
							{navControls}
							{authButton}
						</>
					)}
				</div>
			</nav>
		</div>
	)
}

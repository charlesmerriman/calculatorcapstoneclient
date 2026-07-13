import { useEffect, useLayoutEffect, useState } from "react"
import { motion } from "framer-motion"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { CalendarDays, Calculator as CalculatorIcon, ChevronDown, LogIn, LogOut, Save, UserRound } from "lucide-react"
import { useCalculatorDataSafe } from "../../services/CalculatorContext"
import { userLogout } from "../../services/userServices"
import { IncomeForm } from "../carat-calculator/IncomeForm"
import { ThemePicker } from "./ThemePicker"

export const Navbar = () => {
	const navigate = useNavigate()
	const location = useLocation()
	// null when rendered outside CalculatorProvider (e.g. on the home page)
	const calculatorData = useCalculatorDataSafe()

	const isLoggedIn = !!localStorage.getItem("authToken")

	const [isMobile, setIsMobile] = useState(() =>
		typeof window !== "undefined"
			? window.matchMedia("(max-width: 767px)").matches
			: false
	)
	// True only when the panel open/close was triggered by a user click — not by navigation
	const [animatePanel, setAnimatePanel] = useState(false)

	useEffect(() => {
		const mediaQuery = window.matchMedia("(max-width: 767px)")
		const handleChange = () => setIsMobile(mediaQuery.matches)

		handleChange()
		mediaQuery.addEventListener("change", handleChange)
		return () => mediaQuery.removeEventListener("change", handleChange)
	}, [])

	// Pull the setter out of the context value. It's a useState setter, so its identity is stable
	// across renders — unlike `calculatorData` itself, which is a fresh object literal every render.
	// Depending on the stable setter (instead of the whole object) stops this effect from firing on
	// every render and overwriting the user's Income toggle; it now re-syncs the default open/closed
	// state only when the route or breakpoint actually changes.
	const setIsDropdown = calculatorData?.setIsDropdown

	// useLayoutEffect (not useEffect) so this runs before the browser paints —
	// prevents a visible frame where the income form is missing on navigation to "/app"
	useLayoutEffect(() => {
		if (!setIsDropdown) return
		setAnimatePanel(false)
		setIsDropdown(location.pathname === "/app" && !isMobile)
	}, [isMobile, location.pathname, setIsDropdown])

	const handleLogout = async (): Promise<void> => {
		try {
			await userLogout()
		} catch {
			console.error("Logout failed")
		} finally {
			localStorage.removeItem("authToken")
			navigate("/login")
		}
	}

	const isCalculator = location.pathname === "/app"
	const isTimeline = location.pathname === "/app/timeline"

	const handleIncomeToggle = (): void => {
		if (!calculatorData) return
		setAnimatePanel(true)
		calculatorData.handleDropDownToggle()
	}

	const isDropdown = calculatorData?.isDropdown ?? false
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
	const logo = (
		<Link to="/">
			<img src="/s-blob-v1-IMAGE-uNksC9QIwoUwerewrewrew.png" alt="Henry Handsome Derby" className="h-12 w-auto" />
		</Link>
	)

	// Auth button shown on the right side when outside the app (home mode)
	const authButton = isLoggedIn ? (
		<button
			onClick={handleLogout}
			aria-label="Logout"
			title="Logout"
			className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-600 rounded text-sm text-gray-300 hover:border-gray-400 hover:bg-gray-700 hover:text-white transition"
		>
			<UserRound className="w-4 h-4" />
			Logout
			<LogOut className="w-4 h-4" />
		</button>
	) : (
		<Link
			to="/login"
			className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-600 rounded text-sm text-gray-300 hover:border-gray-400 hover:bg-gray-700 hover:text-white transition"
		>
			<LogIn className="w-4 h-4" />
			Login
		</Link>
	)

	return (
		<div className="z-50 shrink-0">
			{/* Mobile nav */}
			<nav className="bg-gray-800 border-b border-gray-600 md:hidden">
				<div className="flex h-14 items-center justify-between gap-3 px-3">
					<div className="flex min-w-0 items-center">
						{logo}
					</div>

					<div className="flex shrink-0 items-center gap-1.5">
						{calculatorData ? (
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
								<ThemePicker />
								<button
									onClick={handleLogout}
									aria-label="Logout"
									title="Logout"
									className="flex h-9 w-9 items-center justify-center rounded border border-gray-600 text-gray-300 transition hover:border-gray-500 hover:bg-gray-700 hover:text-white"
								>
									<LogOut className="h-4 w-4" />
								</button>
							</>
						) : (
							authButton
						)}
					</div>
				</div>

				{/* Calculator + Timeline always visible; Income tab only in app mode */}
				<div className={`grid ${calculatorData ? "grid-cols-3" : "grid-cols-2"}`}>
					<Link to="/app" className={mobileNavClass(isCalculator)}>
						<CalculatorIcon className="h-4 w-4 shrink-0" />
						<span className="truncate">Calculator</span>
					</Link>
					<Link to="/app/timeline" className={mobileNavClass(isTimeline)}>
						<CalendarDays className="h-4 w-4 shrink-0" />
						<span className="truncate">Timeline</span>
					</Link>
					{calculatorData && (
						<button
							onClick={handleIncomeToggle}
							className={`${mobileNavClass(isDropdown)} cursor-pointer`}
						>
							<UserRound className="h-4 w-4 shrink-0" />
							<span className="truncate">Income</span>
							<ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${isDropdown ? "rotate-180" : ""}`} />
						</button>
					)}
				</div>
			</nav>

			{/* Desktop nav — always three-column; center links always visible */}
			<nav className="hidden grid-cols-[1fr_auto_1fr] items-center px-5 bg-gray-800 border-b border-gray-600 h-14 md:grid">
				{/* Left: Branding */}
				<div className="flex items-center">
					{logo}
				</div>

				{/* Center: Nav links — Calculator + Timeline always shown; Income only in app mode */}
				<div className="flex justify-center items-stretch h-full">
					<Link to="/app" className={desktopNavClass(isCalculator)}>
						<CalculatorIcon className="w-4 h-4" />
						Calculator
					</Link>
					<Link to="/app/timeline" className={desktopNavClass(isTimeline)}>
						<CalendarDays className="w-4 h-4" />
						Timeline
					</Link>
					{calculatorData && (
						<button
							onClick={handleIncomeToggle}
							className={`${desktopNavClass(isDropdown)} cursor-pointer`}
						>
							<UserRound className="w-4 h-4" />
							Income
							<ChevronDown className={`w-3 h-3 transition-transform ${isDropdown ? "rotate-180" : ""}`} />
						</button>
					)}
				</div>

				{/* Right: Save indicator + Theme Picker + Logout/Login */}
				<div className="flex items-center justify-end gap-3">
					{calculatorData ? (
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
							<ThemePicker />
							<button
								onClick={handleLogout}
								className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-600 rounded text-sm text-gray-300 hover:border-gray-400 hover:bg-gray-700 hover:text-white transition"
							>
								<UserRound className="w-4 h-4" />
								Logout
								<LogOut className="w-4 h-4" />
							</button>
						</>
					) : (
						<>
							<ThemePicker />
							{authButton}
						</>
					)}
				</div>
			</nav>

			{/* Income dropdown panel — only rendered in app mode */}
			{calculatorData && (
				<motion.div
					initial={false}
					animate={{ height: isDropdown ? "auto" : 0, opacity: isDropdown ? 1 : 0 }}
					transition={animatePanel ? { duration: 0.2, ease: "easeInOut" } : { duration: 0 }}
					style={{ overflow: "hidden" }}
				>
					<IncomeForm />
				</motion.div>
			)}
		</div>
	)
}

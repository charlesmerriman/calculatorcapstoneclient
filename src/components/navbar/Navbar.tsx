import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { CalendarDays, Calculator as CalculatorIcon, ChevronDown, LogOut, Save, UserRound } from "lucide-react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { userLogout } from "../../services/userServices"
import { IncomeForm } from "../carat-calculator/IncomeForm"

export const Navbar = () => {
	const navigate = useNavigate()
	const location = useLocation()
	const { timerIsGoing, saveNow, handleDropDownToggle, isDropdown, setIsDropdown } = useCalculatorData()

	const incomeButtonRef = useRef<HTMLButtonElement>(null)
	const [caretLeft, setCaretLeft] = useState<number>(0)
	const [isMobile, setIsMobile] = useState(() =>
		typeof window !== "undefined"
			? window.matchMedia("(max-width: 767px)").matches
			: false
	)
	// True only when the panel open/close was triggered by a user click — not by navigation
	const [animatePanel, setAnimatePanel] = useState(false)

	const updateCaretPosition = () => {
		if (incomeButtonRef.current) {
			const rect = incomeButtonRef.current.getBoundingClientRect()
			setCaretLeft(rect.left + rect.width / 2)
		}
	}

	useEffect(() => {
		const mediaQuery = window.matchMedia("(max-width: 767px)")
		const handleChange = () => setIsMobile(mediaQuery.matches)

		handleChange()
		mediaQuery.addEventListener("change", handleChange)
		return () => mediaQuery.removeEventListener("change", handleChange)
	}, [])

	useEffect(() => {
		if (isDropdown && !isMobile) updateCaretPosition()
	}, [isDropdown, isMobile])

	// useLayoutEffect (not useEffect) so this runs before the browser paints —
	// prevents a visible frame where the income form is missing on navigation to "/"
	useLayoutEffect(() => {
		setAnimatePanel(false)
		setIsDropdown(location.pathname === "/" && !isMobile)
	}, [isMobile, location.pathname, setIsDropdown])

	useEffect(() => {
		if (!isDropdown || isMobile) return
		window.addEventListener("resize", updateCaretPosition)
		return () => window.removeEventListener("resize", updateCaretPosition)
	}, [isDropdown, isMobile])

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

	const isCalculator = location.pathname === "/"
	const isTimeline = location.pathname === "/timeline"
	const handleIncomeToggle = (): void => {
		setAnimatePanel(true)
		handleDropDownToggle()
	}

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

	return (
		<div className="z-50 shrink-0">
			<nav className="bg-gray-900 border-b border-gray-700 md:hidden">
				<div className="flex h-14 items-center justify-between gap-3 px-3">
					<div className="flex min-w-0 flex-col justify-center leading-tight select-none">
						<span className="truncate text-base font-bold text-brand">UMA PLANNER</span>
						<span className="truncate text-[10px] text-brand/70">Resource Calculator</span>
					</div>

					<div className="flex shrink-0 items-center gap-1.5">
						<div className="flex h-9 w-9 items-center justify-center">
							{timerIsGoing && (
								<button
									onClick={saveNow}
									aria-label="Save now"
									title="Click to save now"
									className="flex h-9 w-9 items-center justify-center rounded border border-gray-700 text-brand transition hover:border-brand/70 hover:bg-gray-800"
								>
									<Save className="h-4 w-4" />
								</button>
							)}
						</div>
						<button
							onClick={handleLogout}
							aria-label="Logout"
							title="Logout"
							className="flex h-9 w-9 items-center justify-center rounded border border-gray-700 text-gray-300 transition hover:border-gray-500 hover:bg-gray-800 hover:text-white"
						>
							<LogOut className="h-4 w-4" />
						</button>
					</div>
				</div>

				<div className="grid grid-cols-3">
					<Link to="/" className={mobileNavClass(isCalculator)}>
						<CalculatorIcon className="h-4 w-4 shrink-0" />
						<span className="truncate">Calculator</span>
					</Link>
					<Link to="/timeline" className={mobileNavClass(isTimeline)}>
						<CalendarDays className="h-4 w-4 shrink-0" />
						<span className="truncate">Timeline</span>
					</Link>
					<button
						onClick={handleIncomeToggle}
						className={`${mobileNavClass(isDropdown)} cursor-pointer`}
					>
						<UserRound className="h-4 w-4 shrink-0" />
						<span className="truncate">Income</span>
						<ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${isDropdown ? "rotate-180" : ""}`} />
					</button>
				</div>
			</nav>

			<nav className="hidden grid-cols-[auto_1fr_auto] items-center px-5 bg-gray-900 border-b border-gray-700 h-14 md:grid">
				{/* Left: Branding */}
				<div className="flex flex-col justify-center leading-tight select-none">
					<span className="font-bold text-brand text-base">UMA PLANNER</span>
					<span className="text-brand/70 text-[10px]">Resource Calculator</span>
				</div>

				{/* Center: Nav links */}
				<div className="flex justify-center items-stretch h-full">
					<Link
						to="/"
						className={desktopNavClass(isCalculator)}
					>
						<CalculatorIcon className="w-4 h-4" />
						Calculator
					</Link>

					<Link
						to="/timeline"
						className={desktopNavClass(isTimeline)}
					>
						<CalendarDays className="w-4 h-4" />
						Timeline
					</Link>

					<button
						ref={incomeButtonRef}
						onClick={handleIncomeToggle}
						className={`${desktopNavClass(isDropdown)} cursor-pointer`}
					>
						<UserRound className="w-4 h-4" />
						Income
						<ChevronDown className={`w-3 h-3 transition-transform ${isDropdown ? "rotate-180" : ""}`} />
					</button>
				</div>

				{/* Right: Save indicator + Logout */}
				<div className="flex items-center gap-3">
					{/* Fixed-width slot keeps the right grid column stable so the center nav links don't shift */}
					<div className="w-9 h-9 flex items-center justify-center">
						{timerIsGoing && (
							<button
								onClick={saveNow}
								className="cursor-pointer hover:opacity-70 transition-opacity"
								title="Click to save now"
							>
								<Save className="h-5 w-5 text-brand" />
							</button>
						)}
					</div>
					<button
						onClick={handleLogout}
						className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-600 rounded text-sm text-gray-300 hover:border-gray-400 hover:text-white transition"
					>
						<UserRound className="w-4 h-4" />
						Logout
						<LogOut className="w-4 h-4" />
					</button>
				</div>
			</nav>

			<motion.div
				initial={false}
				animate={{ height: isDropdown ? "auto" : 0, opacity: isDropdown ? 1 : 0 }}
				transition={animatePanel ? { duration: 0.2, ease: "easeInOut" } : { duration: 0 }}
				style={{ overflow: "hidden" }}
			>
				{/* Orange pointer caret anchored under the Income button */}
				<div className="relative hidden h-0 bg-gray-900 md:block">
					<div
						className="absolute z-10"
						style={{
							left: caretLeft,
							top: 0,
							transform: "translateX(-50%)",
							width: 0,
							height: 0,
							borderLeft: "9px solid transparent",
							borderRight: "9px solid transparent",
							borderBottom: "9px solid #E6D28A",
						}}
					/>
				</div>
				<IncomeForm />
			</motion.div>
		</div>
	)
}

import { useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useCalculatorData } from "../../services/CalculatorContext"
import { userLogout } from "../../services/userServices"
import { IncomeForm } from "../carat-calculator/IncomeForm"

export const Navbar = () => {
	const navigate = useNavigate()
	const location = useLocation()
	const { timerIsGoing, saveNow, handleDropDownToggle, isDropdown } = useCalculatorData()

	const incomeButtonRef = useRef<HTMLButtonElement>(null)
	const [caretLeft, setCaretLeft] = useState<number>(0)

	const updateCaretPosition = () => {
		if (incomeButtonRef.current) {
			const rect = incomeButtonRef.current.getBoundingClientRect()
			setCaretLeft(rect.left + rect.width / 2)
		}
	}

	useEffect(() => {
		if (isDropdown) updateCaretPosition()
	}, [isDropdown])

	useEffect(() => {
		if (!isDropdown) return
		window.addEventListener("resize", updateCaretPosition)
		return () => window.removeEventListener("resize", updateCaretPosition)
	}, [isDropdown])

	const handleLogout = async (): Promise<void> => {
		try {
			await userLogout()
			localStorage.removeItem("authToken")
			navigate("/login")
		} catch {
			console.error("Logout failed")
		}
	}

	const isCalculator = location.pathname === "/"
	const isTimeline = location.pathname === "/timeline"

	return (
		<div className="sticky top-0 z-50">
			<nav className="grid grid-cols-[auto_1fr_auto] items-center px-5 bg-gray-900 border-b border-gray-700 h-14">
				{/* Left: Branding */}
				<div className="flex flex-col justify-center leading-tight select-none">
					<span className="font-bold text-brand text-base">UMA PLANNER</span>
					<span className="text-brand/70 text-[10px]">Resource Calculator</span>
				</div>

				{/* Center: Nav links */}
				<div className="flex justify-center items-stretch h-full">
					<Link
						to="/"
						className={`flex items-center gap-1.5 px-5 text-sm transition border-b-2 ${
							isCalculator
								? "text-brand border-brand"
								: "text-gray-400 border-transparent hover:text-gray-200"
						}`}
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
							<rect x="4" y="2" width="16" height="20" rx="2" />
							<line x1="8" y1="6" x2="16" y2="6" />
							<line x1="8" y1="10" x2="10" y2="10" />
							<line x1="14" y1="10" x2="16" y2="10" />
							<line x1="8" y1="14" x2="10" y2="14" />
							<line x1="14" y1="14" x2="16" y2="14" />
							<line x1="8" y1="18" x2="10" y2="18" />
							<line x1="14" y1="18" x2="16" y2="18" />
						</svg>
						Calculator
					</Link>

					<Link
						to="/timeline"
						className={`flex items-center gap-1.5 px-5 text-sm transition border-b-2 ${
							isTimeline
								? "text-brand border-brand"
								: "text-gray-400 border-transparent hover:text-gray-200"
						}`}
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
							<rect x="3" y="4" width="18" height="18" rx="2" />
							<line x1="16" y1="2" x2="16" y2="6" />
							<line x1="8" y1="2" x2="8" y2="6" />
							<line x1="3" y1="10" x2="21" y2="10" />
						</svg>
						Timeline
					</Link>

					<button
						ref={incomeButtonRef}
						onClick={handleDropDownToggle}
						className={`flex items-center gap-1.5 px-5 text-sm transition border-b-2 cursor-pointer ${
							isDropdown
								? "text-brand border-brand"
								: "text-gray-400 border-transparent hover:text-gray-200"
						}`}
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
							<circle cx="12" cy="8" r="4" />
							<path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
							<path d="M17 3l1 2h2l-1.5 1.5.5 2L17 7.5 15 8.5l.5-2L14 5h2z" />
						</svg>
						Income
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-3 h-3 transition-transform ${isDropdown ? "rotate-180" : ""}`}>
							<polyline points="6 9 12 15 18 9" />
						</svg>
					</button>
				</div>

				{/* Right: Save indicator + Logout */}
				<div className="flex items-center gap-3">
					{timerIsGoing ? (
						<button
							onClick={saveNow}
							className="cursor-pointer hover:opacity-70 transition-opacity"
							title="Click to save now"
						>
							<div className="h-5 w-5 border-2 border-gray-600 border-t-brand rounded-full animate-spin" />
						</button>
					) : null}
					<button
						onClick={handleLogout}
						className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-600 rounded text-sm text-gray-300 hover:border-gray-400 hover:text-white transition"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
							<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
							<circle cx="12" cy="7" r="4" />
						</svg>
						Logout
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
							<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
							<polyline points="16 17 21 12 16 7" />
							<line x1="21" y1="12" x2="9" y2="12" />
						</svg>
					</button>
				</div>
			</nav>

			{/* Orange pointer caret anchored under the Income button */}
			{isDropdown && (
				<div className="relative h-0 bg-gray-900">
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
			)}

			{isDropdown ? <IncomeForm /> : null}
		</div>
	)
}

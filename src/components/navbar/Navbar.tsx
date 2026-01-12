import { Link, useNavigate } from "react-router-dom"
import { useCalculatorData } from "../../services/CalculatorContext"
import { useState } from "react"
import { IncomeForm } from "../carat-calculator/IncomeForm"

interface LogoutResponse {
	message: string
}

const userLogout = async (): Promise<LogoutResponse> => {
	const token = localStorage.getItem("authToken")

	try {
		const response = await fetch("http://localhost:8000/logout", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Token ${token}`
			}
		})

		const data = await response.json()

		if (!response.ok) {
			throw new Error(data.error || "Logout failed")
		}
		return data
	} catch (error) {
		console.error("Logout error:", error)
		throw error
	}
}

export const Navbar = () => {
	const navigate = useNavigate()
	const { timerIsGoing, saveNow, handleDropDownToggle } = useCalculatorData()

	const handleLogout = async () => {
		try {
			await userLogout()
			localStorage.removeItem("authToken")
			navigate("/login")
		} catch {
			console.error("Logout failed")
		}
	}

	return (
		<>
			<div>{/*Header Section*/}</div>

			<nav className="grid grid-cols-[1fr_5fr_1fr] sticky top-0 z-50 bg-[#7aa6a5]">

				{/*Left*/}
				<div className="flex justify-center items-center">
					{timerIsGoing ? (
						<button
							onClick={saveNow}
							className="cursor-pointer hover:opacity-70 transition-opacity"
							title="Click to save now"
						>
							<div className="h-8 w-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
						</button>
					) : (
						""
					)}
				</div>

				{/*Middle*/}
				<div className="flex justify-evenly items-center">
					<div className="btn btn-ghost p-7">
						<Link to="/" className="text-base">
							Calculator
						</Link>
					</div>
					<div className="btn btn-ghost p-7">
						<Link to="/timeline" className="text-base">
							Timeline
						</Link>
					</div>
					<div className="btn btn-ghost p-7 text-base" onClick={handleDropDownToggle}>Income ▼</div>
				</div>

				{/*Right side*/}
				<div className="btn btn-ghost p-7 text-base">
					<button onClick={handleLogout}>Logout</button>
				</div>
			</nav>
		</>
	)
}

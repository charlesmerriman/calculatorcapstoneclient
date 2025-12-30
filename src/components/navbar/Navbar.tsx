import { Link, useNavigate } from "react-router-dom"

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
		<nav className="flex justify-between border">
			{/*Left side*/}
			<div className="btn btn-ghost">
				<Link to="/">Home</Link>
			</div>
			{/*Right side*/}
			<div className="btn btn-ghost">
				<button onClick={handleLogout}>Logout</button>
			</div>
		</nav>
	)
}

//TODO: Income user info dropdown menu

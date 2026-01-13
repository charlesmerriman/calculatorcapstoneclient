interface LoginCredentials {
	username: string
	password: string
}

interface LoginResponse {
	token?: string
	user?: {
		id: number
		username: string
		email: string
	}
	error?: string
}

interface RegisterCredentials {
	username: string
	password: string
	email: string
	first_name: string
	last_name: string
}

interface RegisterResponse {
	token?: string
	user?: {
		id: number
		username: string
		email: string
	}
	error?: string
}

interface LogoutResponse {
	message: string
}


export const userLogin = async (
	credentials: LoginCredentials
): Promise<LoginResponse> => {
	try {
		const response = await fetch("http://localhost:8000/login", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(credentials)
		})

		const data = await response.json()

		if (!response.ok) {
			throw new Error(data.error || "Login failed")
		}

		if (data.token) {
			localStorage.setItem("authToken", data.token)
		}

		return data
	} catch (error) {
		console.error("Login error:", error)
		throw error
	}
}

export const userRegister = async (
	credentials: RegisterCredentials
): Promise<RegisterResponse> => {
	try {
		const response = await fetch("http://localhost:8000/register", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(credentials)
		})

		const data = await response.json()

		if (!response.ok) {
			throw new Error(data.error || "Registration failed")
		}

		if (data.token) {
			localStorage.setItem("authToken", data.token)
		}

		return data
	} catch (error) {
		console.error("Registration error:", error)
		throw error
	}
}


export const userLogout = async (): Promise<LogoutResponse> => {
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
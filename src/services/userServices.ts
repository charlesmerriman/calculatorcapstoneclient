/**
 * User authentication API services.
 *
 * TYPESCRIPT CONCEPT: File Extensions (.ts vs .tsx)
 *
 * This file was originally .tsx but contains no JSX — only fetch calls
 * and type definitions. The .tsx extension tells the TypeScript compiler
 * to enable JSX parsing, which is unnecessary overhead here and can cause
 * subtle parsing differences (e.g., `<Type>value` is ambiguous in .tsx).
 * Rule of thumb: use .tsx ONLY for files that contain JSX elements.
 */

const API_URL = import.meta.env.VITE_API_URL

/**
 * Custom error that carries field-level validation errors from the API.
 * Used so components can call setError(fieldName, ...) on specific form fields
 * rather than always falling back to a generic root error.
 *
 * Example: { username: "A user with that username already exists." }
 */
export class ApiError extends Error {
	fieldErrors: Partial<Record<string, string>>

	constructor(message: string, fieldErrors: Partial<Record<string, string>> = {}) {
		super(message)
		this.fieldErrors = fieldErrors
	}
}

/**
 * TYPESCRIPT CONCEPT: Modeling API Contracts
 *
 * These interfaces document what the API expects (request) and returns
 * (response). Even though TypeScript can't verify the server response
 * at runtime, having these types means:
 *   1. Callers get autocomplete on the response
 *   2. If you refactor the API, the types guide you to update all callers
 *   3. New team members can read the types to understand the API shape
 */

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

export async function userLogin(
	credentials: LoginCredentials
): Promise<LoginResponse> {
	/**
	 * TYPESCRIPT CONCEPT: `as` Assertions at API Boundaries
	 *
	 * `response.json()` returns Promise<any>. We assign the result to a
	 * typed variable so the rest of the function gets type checking.
	 * This is one of the few places where an implicit `any` is unavoidable
	 * (fetch doesn't know your API shape). The typed variable acts as a
	 * trust boundary — "from here on, treat this as LoginResponse."
	 *
	 * For stronger guarantees, you'd validate with a library like Zod:
	 *   const data = LoginResponseSchema.parse(await response.json())
	 */
	const response = await fetch(`${API_URL}/login`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify(credentials)
	})

	const data: LoginResponse = await response.json()

	if (!response.ok) {
		throw new Error(data.error ?? "Login failed")
	}

	if (data.token) {
		localStorage.setItem("authToken", data.token)
	}

	return data
}

export async function userRegister(
	credentials: RegisterCredentials
): Promise<RegisterResponse> {
	const response = await fetch(`${API_URL}/register`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify(credentials)
	})

	const data: RegisterResponse = await response.json()

	if (!response.ok) {
		// DRF returns field validation errors as { fieldName: ["message", ...], ... }
		// Parse them so the form can show errors inline on the right fields.
		const raw = data as unknown as Record<string, unknown>
		const fieldErrors: Partial<Record<string, string>> = {}
		let firstMessage = ""

		for (const [key, val] of Object.entries(raw)) {
			const msg = Array.isArray(val) && typeof val[0] === "string" ? val[0] : null
			if (msg) {
				fieldErrors[key] = msg
				if (!firstMessage) firstMessage = msg
			}
		}

		throw new ApiError(firstMessage || "Registration failed. Please try again.", fieldErrors)
	}

	if (data.token) {
		localStorage.setItem("authToken", data.token)
	}

	return data
}

export async function userLogout(): Promise<LogoutResponse> {
	const token = localStorage.getItem("authToken")

	const response = await fetch(`${API_URL}/logout`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Token ${token}`
		}
	})

	const data: LogoutResponse = await response.json()

	if (!response.ok) {
		/**
		 * TYPESCRIPT CONCEPT: The `in` Operator for Runtime Type Checking
		 *
		 * LogoutResponse only has `message`, not `error`. But the server
		 * might return an error object on failure. We use `in` to safely
		 * check if the property exists on the untyped error response.
		 * This is a runtime check, not a type-level one.
		 */
		const errorMessage =
			"error" in data && typeof data.error === "string"
				? data.error
				: "Logout failed"
		throw new Error(errorMessage)
	}

	return data
}

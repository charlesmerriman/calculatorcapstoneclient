import { useForm, useWatch } from "react-hook-form"
import { userRegister, ApiError } from "../../services/userServices"
import { Link, useNavigate } from "react-router-dom"
import type React from "react"
import { Footer } from "../footer/Footer"
import { readGuestPlanStash } from "../../services/guestMigration"

interface RegisterFormData {
	email: string
	username: string
	first_name: string
	last_name: string
	password: string
	confirmPassword: string
}

const inputCls =
	"w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 " +
	"text-sm text-gray-100 focus:border-brand focus:outline-none transition"

const labelCls = "block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5"

export const Register: React.FC = () => {
	const {
		register,
		handleSubmit,
		setError,
		control,
		formState: { errors, isSubmitting }
	} = useForm<RegisterFormData>()
	const navigate = useNavigate()
	const password = useWatch({ control, name: "password" })

	const handleRegisterSubmit = async (data: RegisterFormData): Promise<void> => {
		try {
			const { confirmPassword: _confirmPassword, ...registerData } = data
			await userRegister(registerData)
			navigate("/app")
		} catch (e) {
			if (e instanceof ApiError && Object.keys(e.fieldErrors).length > 0) {
				// Map server field errors (e.g. "username already exists") to the correct field
				for (const [field, message] of Object.entries(e.fieldErrors)) {
					setError(field as keyof RegisterFormData, { message })
				}
			} else {
				setError("root", {
					message: e instanceof Error ? e.message : "Registration failed. Please try again.",
				})
			}
		}
	}

	return (
		<div className="flex min-h-screen flex-col bg-gray-900 p-4">
			<div className="m-auto w-full max-w-sm bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
				{/* Brand header strip */}
				<div className="border-b border-gray-700 px-8 py-4 flex justify-center">
					<img src="/s-blob-v1-IMAGE-uNksC9QIwoUwerewrewrew.png" alt="Henry Handsome Derby" className="h-28 w-auto" />
				</div>

				<div className="px-8 py-7">
					<h2 className="text-xl font-semibold text-gray-100 mb-6">Create Account</h2>

					{/* Shown when the user arrived via "Sign in to save" with a guest plan pending migration */}
					{readGuestPlanStash() && (
						<div className="mb-5 px-3 py-2.5 bg-brand/10 border border-brand/30 rounded-lg">
							<p className="text-brand text-sm">
								Your current plan will be saved to your account after you register.
							</p>
						</div>
					)}

					<form onSubmit={handleSubmit(handleRegisterSubmit)} noValidate>
						<div className="mb-4">
							<label htmlFor="username" className={labelCls}>Username</label>
							<input
								type="text"
								id="username"
								{...register("username", { required: "Username is required." })}
								autoComplete="username"
								className={inputCls}
							/>
							{errors.username && (
								<p className="text-red-400 text-xs mt-1.5">{errors.username.message}</p>
							)}
						</div>

						<div className="mb-4">
							<label htmlFor="email" className={labelCls}>Email</label>
							<input
								type="email"
								id="email"
								{...register("email", { required: "Email is required." })}
								autoComplete="email"
								className={inputCls}
							/>
							{errors.email && (
								<p className="text-red-400 text-xs mt-1.5">{errors.email.message}</p>
							)}
						</div>

						{/* First and last name side by side */}
						<div className="grid grid-cols-1 gap-3 mb-4 sm:grid-cols-2">
							<div>
								<label htmlFor="first_name" className={labelCls}>First Name</label>
								<input
									type="text"
									id="first_name"
									{...register("first_name", { required: "Required." })}
									autoComplete="given-name"
									className={inputCls}
								/>
								{errors.first_name && (
									<p className="text-red-400 text-xs mt-1.5">{errors.first_name.message}</p>
								)}
							</div>
							<div>
								<label htmlFor="last_name" className={labelCls}>Last Name</label>
								<input
									type="text"
									id="last_name"
									{...register("last_name", { required: "Required." })}
									autoComplete="family-name"
									className={inputCls}
								/>
								{errors.last_name && (
									<p className="text-red-400 text-xs mt-1.5">{errors.last_name.message}</p>
								)}
							</div>
						</div>

						<div className="mb-4">
							<label htmlFor="password" className={labelCls}>Password</label>
							<input
								type="password"
								id="password"
								{...register("password", {
									required: "Password is required.",
									minLength: { value: 8, message: "Must be at least 8 characters." },
								})}
								autoComplete="new-password"
								className={inputCls}
							/>
							{errors.password && (
								<p className="text-red-400 text-xs mt-1.5">{errors.password.message}</p>
							)}
						</div>

						<div className="mb-6">
							<label htmlFor="confirmPassword" className={labelCls}>Confirm Password</label>
							<input
								type="password"
								id="confirmPassword"
								{...register("confirmPassword", {
									required: "Please confirm your password.",
									validate: (value) => value === password || "Passwords do not match.",
								})}
								autoComplete="new-password"
								className={inputCls}
							/>
							{errors.confirmPassword && (
								<p className="text-red-400 text-xs mt-1.5">{errors.confirmPassword.message}</p>
							)}
						</div>

						{errors.root && (
							<div className="mb-5 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg">
								<p className="text-red-400 text-sm">{errors.root.message}</p>
							</div>
						)}

						<button
							type="submit"
							disabled={isSubmitting}
							className="w-full py-2.5 rounded-lg font-bold text-sm bg-brand text-black
								hover:bg-brand/85 transition cursor-pointer
								disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isSubmitting ? "Creating account…" : "Create Account"}
						</button>
					</form>

					<p className="text-center text-sm text-gray-500 mt-6">
						Already have an account?{" "}
						<Link to="/login" className="text-brand hover:text-brand/75 transition font-medium">
							Sign in
						</Link>
					</p>
				</div>
			</div>
			<Footer />
		</div>
	)
}

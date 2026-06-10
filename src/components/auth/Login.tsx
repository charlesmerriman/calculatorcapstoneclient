import { useForm } from "react-hook-form"
import { userLogin } from "../../services/userServices"
import { Link, useNavigate } from "react-router-dom"
import type React from "react"

interface LoginFormData {
	username: string
	password: string
}

const inputCls =
	"w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 " +
	"text-sm text-gray-100 focus:border-brand focus:outline-none transition"

const labelCls = "block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5"

export const Login: React.FC = () => {
	const {
		register,
		handleSubmit,
		setError,
		formState: { errors, isSubmitting }
	} = useForm<LoginFormData>()
	const navigate = useNavigate()

	const handleLoginSubmit = async (data: LoginFormData): Promise<void> => {
		try {
			await userLogin(data)
			navigate("/")
		} catch {
			setError("root", { message: "Invalid username or password." })
		}
	}

	return (
		<div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
			<div className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
				{/* Brand header strip */}
				<div className="border-b border-gray-700 px-8 py-4 flex justify-center">
					<img src="/s-blob-v1-IMAGE-uNksC9QIwoUwerewrewrew.png" alt="Henry Handsome Derby" className="h-28 w-auto" />
				</div>

				<div className="px-8 py-7">
					<h2 className="text-xl font-semibold text-gray-100 mb-6">Sign In</h2>

					<form onSubmit={handleSubmit(handleLoginSubmit)} noValidate>
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

						<div className="mb-6">
							<label htmlFor="password" className={labelCls}>Password</label>
							<input
								type="password"
								id="password"
								{...register("password", { required: "Password is required." })}
								autoComplete="current-password"
								className={inputCls}
							/>
							{errors.password && (
								<p className="text-red-400 text-xs mt-1.5">{errors.password.message}</p>
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
							{isSubmitting ? "Signing in…" : "Sign In"}
						</button>
					</form>

					<p className="text-center text-sm text-gray-500 mt-6">
						Don't have an account?{" "}
						<Link to="/register" className="text-brand hover:text-brand/75 transition font-medium">
							Create one
						</Link>
					</p>
				</div>
			</div>
		</div>
	)
}

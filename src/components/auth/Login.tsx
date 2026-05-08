import { useForm } from "react-hook-form"
import { userLogin } from "../../services/userServices"
import { Link, useNavigate } from "react-router-dom"
import type React from "react"

interface LoginFormData {
	username: string
	password: string
}

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
			setError("root", { message: "Invalid username or password" })
		}
	}

	return (
		<div className="page-auth rounded-lg">
			<form onSubmit={handleSubmit(handleLoginSubmit)} className="card-auth">
				<h2 className="heading-auth">Login</h2>

				<div className="form-row-auth">
					<label htmlFor="username" className="label-auth">Username:</label>
					<input
						type="text"
						id="username"
						{...register("username", { required: "Username is required" })}
						autoComplete="username"
						className="input-auth"
					/>
				</div>

				<div className="form-row-auth">
					<label htmlFor="password" className="label-auth">Password:</label>
					<input
						type="password"
						id="password"
						{...register("password", { required: "Password is required" })}
						autoComplete="current-password"
						className="input-auth"
					/>
				</div>

				{errors.root && <div className="text-error">{errors.root.message}</div>}

				<button type="submit" disabled={isSubmitting} className="w-full px-4 py-2 rounded font-semibold bg-gray-700 text-gray-100 border border-gray-600 hover:bg-gray-600 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
					{isSubmitting ? "Loading..." : "Login"}
				</button>

				<section className="register-link text-center m-4">
					<Link to="/register">Not a member yet?</Link>
				</section>
			</form>
		</div>
	)
}
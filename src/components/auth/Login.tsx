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

	const handleLoginSubmit = async (data: LoginFormData) => {
		try {
			const response = await userLogin(data)
			console.log("Login successful:", response)
			navigate("/")
		} catch {
			setError("root", { message: "Invalid username or password" })
		}
	}

	return (
		<div>
			<h2>Login</h2>
			<form onSubmit={handleSubmit(handleLoginSubmit)}>
				<div>
					<label htmlFor="username">Username:</label>
					<input
						type="text"
						id="username"
						{...register("username", { required: "Username is required" })}
						autoComplete="username"
					/>
				</div>

				<div>
					<label htmlFor="password">Password:</label>
					<input
						type="password"
						id="password"
						{...register("password", { required: "Password is required" })}
						autoComplete="current-password"
					/>
				</div>

				{errors.root && (
					<div className="text-red-500">{errors.root.message}</div>
				)}

				<button type="submit" disabled={isSubmitting}>
					{isSubmitting ? "Loading..." : "Login"}
				</button>
			</form>
			<section className="register-link">
				<Link to="/register">Not a member yet?</Link>
			</section>
		</div>
	)
}

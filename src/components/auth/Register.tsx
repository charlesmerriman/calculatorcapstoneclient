import { useForm } from "react-hook-form"
import { userRegister } from "../../services/userServices"
import { useNavigate } from "react-router-dom"
import type React from "react"

interface RegisterFormData {
	email: string
	username: string
	first_name: string
	last_name: string
	password: string
	confirmPassword: string
}

export const Register: React.FC = () => {
	const {
		register,
		handleSubmit,
		watch,
		setError,
		formState: { errors, isSubmitting }
	} = useForm<RegisterFormData>()
	const navigate = useNavigate()

	const password = watch("password")

	const handleRegisterSubmit = async (data: RegisterFormData) => {
		try {
			const { confirmPassword, ...registerData } = data

			const response = await userRegister(registerData)
			console.log("Registration successful:", response)
			navigate("/")
		} catch {
			setError("root", { message: "Registration failed. Please try again." })
		}
	}

	return (
		<div>
			<form onSubmit={handleSubmit(handleRegisterSubmit)}>
				<div>
					<label htmlFor="username">Username:</label>
					<input
						type="text"
						id="username"
						{...register("username", { required: "Username is required" })}
						autoComplete="username"
					/>
					{errors.username && (
						<span className="text-red-500">{errors.username.message}</span>
					)}
				</div>

				<div>
					<label htmlFor="email">Email:</label>
					<input
						type="text"
						id="email"
						{...register("email", { required: "Email is required" })}
						autoComplete="email"
					/>
					{errors.email && (
						<span className="text-red-500">{errors.email.message}</span>
					)}
				</div>

				<div>
					<label htmlFor="first_name">First Name:</label>
					<input
						type="text"
						id="first_name"
						{...register("first_name", { required: "First name is required" })}
						autoComplete="given-name"
					/>
					{errors.first_name && (
						<span className="text-red-500">{errors.first_name.message}</span>
					)}
				</div>

				<div>
					<label htmlFor="last_name">Last Name:</label>
					<input
						type="text"
						id="last_name"
						{...register("last_name", { required: "Last name is required" })}
						autoComplete="last_name"
					/>
					{errors.last_name && (
						<span className="text-red-500">{errors.last_name.message}</span>
					)}
				</div>

				<div>
					<label htmlFor="password">Password:</label>
					<input
						type="password"
						id="password"
						{...register("password", { required: "Password is required" })}
						autoComplete="new-password"
					/>
					{errors.password && (
						<span className="text-red-500">{errors.password.message}</span>
					)}
				</div>

				<div>
					<label htmlFor="confirmPassword">Confirm Password:</label>
					<input
						type="password"
						id="confirmPassword"
						{...register("confirmPassword", {
							required: "Please confirm your password",
							validate: (value) =>
								value === password || "Passwords do not match"
						})}
						autoComplete="new-password"
					/>
					{errors.confirmPassword && (
						<span className="text-red-500">
							{errors.confirmPassword.message}
						</span>
					)}
				</div>

				{errors.root && (
					<div className="text-red-500">{errors.root.message}</div>
				)}

				<button type="submit" disabled={isSubmitting}>
					{isSubmitting ? "Registering..." : "Register"}
				</button>
			</form>
		</div>
	)
}

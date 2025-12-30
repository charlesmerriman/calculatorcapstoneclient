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
		<div className="min-h-screen flex flex-wrap justify-center items-center bg-gray-700 p-4 rounded-lg max-w-150 mx-auto">
			<form
				onSubmit={handleSubmit(handleRegisterSubmit)}
				className="shadow rounded-lg p-6 md:p-8 w-full max-w-md items-center justify-center bg-gray-500"
			>
				<h2 className="text-2xl font-semibold mb-6 w-full text-center">
					Register
				</h2>
				<div className="mb-4 flex justify-center items-center">
					<label
						htmlFor="username"
						className="block text-sm font-medium mb-1 mr-1 w-25"
					>
						Username:
					</label>
					<input
						type="text"
						id="username"
						{...register("username", { required: "Username is required" })}
						autoComplete="username"
						className="w-full border border-gray-300 rounded-md px-3 py-2"
					/>
					{errors.username && (
						<span className="text-red-500">{errors.username.message}</span>
					)}
				</div>

				<div className="mb-4 flex justify-center items-center">
					<label
						htmlFor="email"
						className="block text-sm font-medium mb-1 mr-1 w-25"
					>
						Email:
					</label>
					<input
						type="text"
						id="email"
						{...register("email", { required: "Email is required" })}
						autoComplete="email"
						className="w-full border border-gray-300 rounded-md px-3 py-2"
					/>
					{errors.email && (
						<span className="text-red-500">{errors.email.message}</span>
					)}
				</div>

				<div className="mb-4 flex justify-center items-center">
					<label
						htmlFor="first_name"
						className="block text-sm font-medium mb-1 mr-1 w-25"
					>
						First Name:
					</label>
					<input
						type="text"
						id="first_name"
						{...register("first_name", { required: "First name is required" })}
						autoComplete="given-name"
						className="w-full border border-gray-300 rounded-md px-3 py-2"
					/>
					{errors.first_name && (
						<span className="text-red-500">{errors.first_name.message}</span>
					)}
				</div>

				<div className="mb-4 flex justify-center items-center">
					<label
						htmlFor="last_name"
						className="block text-sm font-medium mb-1 mr-1 w-25"
					>
						Last Name:
					</label>
					<input
						type="text"
						id="last_name"
						{...register("last_name", { required: "Last name is required" })}
						autoComplete="last_name"
						className="w-full border border-gray-300 rounded-md px-3 py-2"
					/>
					{errors.last_name && (
						<span className="text-red-500">{errors.last_name.message}</span>
					)}
				</div>

				<div className="mb-4 flex justify-center items-center">
					<label
						htmlFor="password"
						className="block text-sm font-medium mb-1 mr-1 w-25"
					>
						Password:
					</label>
					<input
						type="password"
						id="password"
						{...register("password", { required: "Password is required" })}
						autoComplete="new-password"
						className="w-full border border-gray-300 rounded-md px-3 py-2"
					/>
					{errors.password && (
						<span className="text-red-500">{errors.password.message}</span>
					)}
				</div>

				<div className="mb-4 flex justify-center items-center">
					<label
						htmlFor="confirmPassword"
						className="block text-sm font-medium mb-1 mr-1 w-25"
					>
						Confirm Password:
					</label>
					<input
						type="password"
						id="confirmPassword"
						{...register("confirmPassword", {
							required: "Please confirm your password",
							validate: (value) =>
								value === password || "Passwords do not match"
						})}
						autoComplete="new-password"
						className="w-full border border-gray-300 rounded-md px-3 py-2"
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

				<button type="submit" disabled={isSubmitting} className="btn w-full">
					{isSubmitting ? "Registering..." : "Register"}
				</button>
			</form>
		</div>
	)
}

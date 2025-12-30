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
		<div className="min-h-screen flex flex-wrap justify-center items-center bg-gray-700 p-4 rounded-lg max-w-150 mx-auto">
			<form
				onSubmit={handleSubmit(handleLoginSubmit)}
				className="shadow rounded-lg p-6 md:p-8 w-full max-w-md items-center justify-center bg-gray-500"
			>
				<h2 className="text-2xl font-semibold mb-6 w-full text-center">
					Login
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
						autoComplete="current-password"
						className="w-full border border-gray-300 rounded-md px-3 py-2"
					/>
				</div>
				{errors.root && (
					<div className="text-red-500">{errors.root.message}</div>
				)}
				<button type="submit" disabled={isSubmitting} className="btn w-full">
					{isSubmitting ? "Loading..." : "Login"}
				</button>{" "}
				<section className="register-link text-center m-4">
					<Link to="/register">Not a member yet?</Link>
				</section>
			</form>
		</div>
	)
}

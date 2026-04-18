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

/** Config for each form field — drives the rendering loop below */
const FIELDS = [
	{ id: "username", label: "Username:", type: "text", autoComplete: "username", required: "Username is required" },
	{ id: "email", label: "Email:", type: "text", autoComplete: "email", required: "Email is required" },
	{ id: "first_name", label: "First Name:", type: "text", autoComplete: "given-name", required: "First name is required" },
	{ id: "last_name", label: "Last Name:", type: "text", autoComplete: "family-name", required: "Last name is required" },
	{ id: "password", label: "Password:", type: "password", autoComplete: "new-password", required: "Password is required" },
] as const

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

	const handleRegisterSubmit = async (data: RegisterFormData): Promise<void> => {
		try {
			const { confirmPassword: _confirmPassword, ...registerData } = data
			await userRegister(registerData)
			navigate("/")
		} catch {
			setError("root", { message: "Registration failed. Please try again." })
		}
	}

	return (
		<div>
			<div className="page-auth">
				<form onSubmit={handleSubmit(handleRegisterSubmit)} className="card-auth">
					<h2 className="heading-auth">Register</h2>

					{FIELDS.map((field) => (
						<div key={field.id} className="form-row-auth">
							<label htmlFor={field.id} className="label-auth">{field.label}</label>
							<input
								type={field.type}
								id={field.id}
								{...register(field.id as keyof RegisterFormData, { required: field.required })}
								autoComplete={field.autoComplete}
								className="input-auth"
							/>
							{errors[field.id as keyof RegisterFormData] && (
								<span className="text-error">
									{errors[field.id as keyof RegisterFormData]?.message}
								</span>
							)}
						</div>
					))}

					<div className="form-row-auth">
						<label htmlFor="confirmPassword" className="label-auth">Confirm Password:</label>
						<input
							type="password"
							id="confirmPassword"
							{...register("confirmPassword", {
								required: "Please confirm your password",
								validate: (value) => value === password || "Passwords do not match"
							})}
							autoComplete="new-password"
							className="input-auth"
						/>
						{errors.confirmPassword && (
							<span className="text-error">{errors.confirmPassword.message}</span>
						)}
					</div>

					{errors.root && <div className="text-error">{errors.root.message}</div>}

					<button type="submit" disabled={isSubmitting} className="btn w-full">
						{isSubmitting ? "Registering..." : "Register"}
					</button>
				</form>
			</div>
		</div>
	)
}
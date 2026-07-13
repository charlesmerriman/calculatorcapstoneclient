import "./App.css"
import { Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "sonner"
import { ApplicationViews } from "./views/ApplicationViews.js"
import { Login } from "./components/auth/Login.js"
import { Register } from "./components/auth/Register.js"
import { Authorized } from "./views/Authorized.js"
import { CalculatorProvider } from "./services/CalculatorProvider.js"
import { ErrorBoundary } from "./components/ErrorBoundary.js"
import { ThemeProvider } from "./services/ThemeProvider.js"
import { HomePage } from "./components/home/HomePage.js"
import { PrivacyPolicy } from "./components/legal/PrivacyPolicy.js"

function App() {
	return (
		<ThemeProvider>
			<ErrorBoundary>
				<Toaster theme="dark" position="bottom-right" richColors />
				<Routes>
					<Route path="/" element={<HomePage />} />
					<Route path="/login" element={<Login />} />
					<Route path="/register" element={<Register />} />
					<Route path="/privacy-policy" element={<PrivacyPolicy />} />
					<Route
						path="/app/*"
						element={
							<Authorized>
								<CalculatorProvider>
									<ApplicationViews />
								</CalculatorProvider>
							</Authorized>
						}
					/>
					{/* Redirect any unmatched path to the home page */}
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</ErrorBoundary>
		</ThemeProvider>
	)
}

export default App

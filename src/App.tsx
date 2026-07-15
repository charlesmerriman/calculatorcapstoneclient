import "./App.css"
import { Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "sonner"
import { ApplicationViews } from "./views/ApplicationViews.js"
import { Login } from "./components/auth/Login.js"
import { Register } from "./components/auth/Register.js"
import { CalculatorProvider } from "./services/CalculatorProvider.js"
import { ErrorBoundary } from "./components/ErrorBoundary.js"
import { ThemeProvider } from "./services/ThemeProvider.js"
import { HomePage } from "./components/home/HomePage.js"
import { PrivacyPolicy } from "./components/legal/PrivacyPolicy.js"
import { Changelog } from "./components/info/Changelog.js"
import { Faq } from "./components/info/Faq.js"
import { Feedback } from "./components/info/Feedback.js"

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
					<Route path="/changelog" element={<Changelog />} />
					<Route path="/faq" element={<Faq />} />
					<Route path="/feedback" element={<Feedback />} />
					{/* Public since guest mode: the calculator works without an
					    account; logging in is only needed to save a plan. */}
					<Route
						path="/app/*"
						element={
							<CalculatorProvider>
								<ApplicationViews />
							</CalculatorProvider>
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

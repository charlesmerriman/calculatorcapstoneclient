import "./App.css"
import { Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "sonner"
import { ApplicationViews } from "./views/ApplicationViews.js"
import { Login } from "./components/auth/Login.js"
import { OAuthCallback } from "./components/auth/OAuthCallback.js"
import { BetaGate } from "./components/auth/BetaGate.js"
import { CalculatorProvider } from "./services/CalculatorProvider.js"
import { ErrorBoundary } from "./components/ErrorBoundary.js"
import { ApiSourceBadge } from "./components/ApiSourceBadge.js"
import { ThemeProvider } from "./services/ThemeProvider.js"
import { useTheme } from "./services/ThemeContext.js"
import { HomePage } from "./components/home/HomePage.js"
import { PrivacyPolicy } from "./components/legal/PrivacyPolicy.js"
import { Changelog } from "./components/info/Changelog.js"
import { Faq } from "./components/info/Faq.js"
import { Feedback } from "./components/info/Feedback.js"

const ThemedToaster = () => {
	const { activeTheme } = useTheme()
	return <Toaster theme={activeTheme === "light" ? "light" : "dark"} position="bottom-right" richColors />
}

function App() {
	return (
		<ThemeProvider>
			<ErrorBoundary>
				<ThemedToaster />
				{/* Dev-only, and only when VITE_API_URL points somewhere remote.
				    Compiles away entirely in production builds. */}
				<ApiSourceBadge />
				<Routes>
					<Route path="/" element={<HomePage />} />
					<Route path="/login" element={<Login />} />
					{/* Where Google/Discord send the browser back to. Must match
					    OAUTH_REDIRECT_URI on the backend and the redirect URI
					    registered in each provider's console, exactly. */}
					<Route path="/auth/callback" element={<OAuthCallback />} />
					<Route path="/privacy-policy" element={<PrivacyPolicy />} />
					<Route path="/changelog" element={<Changelog />} />
					<Route path="/faq" element={<Faq />} />
					<Route path="/feedback" element={<Feedback />} />
					{/* Public since guest mode: the calculator works without an
					    account; logging in is only needed to save a plan.

					    BetaGate is the closed-beta passcode wall, and it sits
					    OUTSIDE CalculatorProvider so no API fetch fires before
					    the passcode is accepted. It renders its children
					    untouched once VITE_BETA_PASSCODE_HASH is unset, so
					    retiring the beta means deleting that variable — and
					    deleting this wrapper plus its import when you want the
					    code gone too. */}
					<Route
						path="/app/*"
						element={
							<BetaGate>
								<CalculatorProvider>
									<ApplicationViews />
								</CalculatorProvider>
							</BetaGate>
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

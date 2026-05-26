import "./App.css"
import { Route, Routes } from "react-router-dom"
import { Toaster } from "sonner"
import { ApplicationViews } from "./views/ApplicationViews.js"
import { Login } from "./components/auth/Login.js"
import { Register } from "./components/auth/Register.js"
import { Authorized } from "./views/Authorized.js"
import { CalculatorProvider } from "./services/CalculatorProvider.js"
import { ErrorBoundary } from "./components/ErrorBoundary.js"
import { ThemeProvider } from "./services/ThemeProvider.js"

function App() {
	return (
		<ThemeProvider>
			<ErrorBoundary>
				<Toaster theme="dark" position="bottom-right" richColors />
				<Routes>
					<Route path="/login" element={<Login />} />
					<Route path="/register" element={<Register />} />
					<Route
						path="*"
						element={
							<Authorized>
								<CalculatorProvider>
									<ApplicationViews />
								</CalculatorProvider>
							</Authorized>
						}
					/>
				</Routes>
			</ErrorBoundary>
		</ThemeProvider>
	)
}

export default App

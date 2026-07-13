import { Navbar } from "../navbar/Navbar"
import { Footer } from "../footer/Footer"

export const HomePage = () => {
	return (
		<div className="flex min-h-dvh flex-col bg-gray-900">
			<Navbar />
			<main className="flex-1 flex flex-col items-center justify-center gap-4 px-4 text-center">
				<h1 className="text-4xl font-bold text-gray-100">Uma Musume Carat Calculator</h1>
				<p className="text-lg text-gray-400 max-w-md">
					Plan your pulls. Know your carats.
				</p>
			</main>
			<Footer />
		</div>
	)
}

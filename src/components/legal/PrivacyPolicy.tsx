import type React from "react"
import { Navbar } from "../navbar/Navbar"
import { Footer } from "../footer/Footer"

// Shared text styles so the sections stay visually consistent and easy to tweak.
const heading = "mt-8 text-xl font-semibold text-gray-100"
const paragraph = "mt-3 leading-relaxed text-gray-300"
const list = "mt-3 list-disc space-y-1 pl-6 leading-relaxed text-gray-300"
const link = "text-brand transition hover:text-brand/75"

/**
 * Public Privacy Policy page (route: /privacy-policy).
 *
 * Required for Google AdSense approval. The content is customized boilerplate that
 * reflects what this site actually collects and does — it is NOT legal advice and
 * should be reviewed before going live with ads.
 */
export const PrivacyPolicy: React.FC = () => {
	return (
		<div className="flex min-h-dvh flex-col bg-gray-900">
			<Navbar />
			<main className="flex-1 overflow-y-auto">
				<div className="mx-auto max-w-3xl px-4 py-8">
					<h1 className="text-3xl font-bold text-gray-100">Privacy Policy</h1>
					<p className="mt-2 text-sm text-gray-500">Last updated: July 15, 2026</p>

					<p className={paragraph}>
						This Privacy Policy explains what information the Uma Musume Carat Calculator
						(&quot;the Site&quot;) collects, how it is used, and the choices you have. By
						using the Site you agree to the practices described below.
					</p>

					<h2 className={heading}>Information We Collect</h2>
					<p className={paragraph}>When you create an account, we collect:</p>
					<ul className={list}>
						<li>Your username, email address, first name, and last name.</li>
						<li>
							Your password, which is stored in a securely hashed form and is never kept
							or readable as plain text.
						</li>
					</ul>
					<p className={paragraph}>
						When you use the calculator, we store the planning data you enter, including your
						current in-game resources (such as carats and tickets), your selected income
						ranks, and the banners you plan to pull on. This data is tied to your account so
						your plan is available the next time you sign in.
					</p>

					<h2 className={heading}>How We Use Your Information</h2>
					<p className={paragraph}>
						We use your account and planning data solely to operate the Site: to
						authenticate you, to save and display your resource projections, and to keep
						your plan synced across sessions. We do not sell your personal information.
					</p>

					<h2 className={heading}>Cookies and Local Storage</h2>
					<p className={paragraph}>
						The Site stores an authentication token in your browser&apos;s local storage to
						keep you signed in. The Site also uses cookies. In addition, once advertising is
						enabled, third-party ad partners (see below) may set cookies on your device.
					</p>

					<h2 className={heading}>Third-Party Advertising</h2>
					<p className={paragraph}>
						We may use third-party advertising companies, including Google, to serve ads when
						you visit the Site. Google, as a third-party vendor, uses cookies to serve ads
						based on your prior visits to this and other websites. Google&apos;s use of
						advertising cookies enables it and its partners to serve ads to you based on your
						visits to this Site and/or other sites on the internet.
					</p>

					<h2 className={heading}>How to Opt Out</h2>
					<p className={paragraph}>
						You may opt out of personalized advertising by visiting{" "}
						<a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className={link}>
							Google Ads Settings
						</a>
						. You can also opt out of a third party&apos;s use of cookies for personalized
						advertising by visiting{" "}
						<a href="https://www.aboutads.info" target="_blank" rel="noopener noreferrer" className={link}>
							www.aboutads.info
						</a>
						.
					</p>

					<h2 className={heading}>Changes to This Policy</h2>
					<p className={paragraph}>
						We may update this Privacy Policy from time to time. Any changes will be posted on
						this page with an updated &quot;Last updated&quot; date.
					</p>

					<h2 className={heading}>Contact Us</h2>
					<p className={paragraph}>
						If you have any questions about this Privacy Policy, you can contact us at{" "}
						<a href="mailto:Henryhandsomederby@gmail.com" className={link}>
							Henryhandsomederby@gmail.com
						</a>
						.
					</p>
				</div>
			</main>
			<Footer />
		</div>
	)
}

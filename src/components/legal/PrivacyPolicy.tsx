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
		// flex-1 on <main> absorbs any leftover viewport height so the footer keeps its
		// fixed ~53px band at the bottom of a short page — leftover space sits above it,
		// not below (footer and page share bg-gray-900, so slack underneath would read as
		// a giant footer). Long content pushes the footer past the fold and it scrolls
		// away normally; note there is no overflow-y-auto here, so the *page* scrolls
		// rather than a nested region, which is what kept the footer permanently visible.
		<div className="flex min-h-dvh flex-col bg-gray-900">
			<Navbar />
			<main className="flex-1">
				<div className="mx-auto max-w-3xl px-4 py-8">
					<h1 className="text-3xl font-bold text-gray-100">Privacy Policy</h1>
					<p className="mt-2 text-sm text-gray-500">Last updated: July 30, 2026</p>

					<p className={paragraph}>
						This Privacy Policy explains what information the Uma Musume Carat Calculator
						(&quot;the Site&quot;) collects, how it is used, and the choices you have. By
						using the Site you agree to the practices described below.
					</p>

					<h2 className={heading}>Information We Collect</h2>
					<p className={paragraph}>
						You can use the calculator without an account at all. If you choose to create
						one, you sign in through Google or Discord, and we deliberately collect as
						little as possible:
					</p>
					<ul className={list}>
						<li>
							An anonymous account reference supplied by Google or Discord. This is an
							opaque identifier that lets us recognize you when you return. It is
							specific to this Site and cannot be used to identify you elsewhere.
						</li>
						<li>
							A randomly generated username, such as <code>user_a3f9c1</code>, created
							by us. You are not asked to choose one.
						</li>
					</ul>
					<p className={paragraph}>
						We do <strong>not</strong> collect or store your email address, your real
						name, your provider display name or avatar, or any password. We never see
						your Google or Discord password — those services verify it and only confirm
						to us that the sign-in succeeded. We request the narrowest permission each
						provider offers, so your email address is never sent to us in the first
						place.
					</p>
					<p className={paragraph}>
						When you use the calculator, we store the planning data you enter, including
						your current in-game resources (such as carats and tickets), your selected
						income ranks, and the banners you plan to pull on. This data is tied to your
						anonymous account so your plan is available the next time you sign in. If you
						use the Site as a guest, your plan stays in your browser and is discarded
						when you leave.
					</p>

					<h2 className={heading}>How We Use Your Information</h2>
					<p className={paragraph}>
						We use your account reference and planning data to operate the Site: to
						recognize you when you sign in, to save and display your resource
						projections, and to keep your plan synced across sessions. We also analyze
						planning data in aggregate, anonymized form — for example, the percentage of
						users who enable certain income options, or the overall popularity of banners
						— to understand how the Site is used and to improve it. These statistics
						never identify individual users. We do not sell your personal information,
						and because we hold no contact details, we cannot send you marketing of any
						kind.
					</p>

					<h2 className={heading}>Account Recovery</h2>
					<p className={paragraph}>
						Because we store no email address, there is no password reset and no way for
						us to verify your identity if you lose access to the Google or Discord
						account you signed in with. If that happens, your saved plan cannot be
						recovered, and you would need to start a new plan. This is a deliberate
						trade-off in exchange for holding none of your personal data.
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

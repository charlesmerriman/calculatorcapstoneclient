import { useEffect } from "react"
import { useLocation } from "react-router-dom"

/**
 * Per-route <title>, description, canonical and robots tags.
 *
 * This is a single-page app: every URL is served the same index.html, and React
 * only ever replaces the contents of #root. Nothing touches <head> unless we do
 * it by hand, so without this hook all eight routes present one identical title
 * and description to browser tabs, to Google, and to anything else reading the
 * document.
 *
 * Deliberately not react-helmet-async. That earns its place when titles are
 * dynamic and numerous (a page per record); here the route set is fixed and
 * small, and this is the whole implementation.
 *
 * NOTE ON LINK PREVIEWS: this cannot fix them. Discord, Slack, Twitter and
 * friends fetch the raw HTML and never execute JavaScript, so they only ever see
 * the static tags in index.html. Those are set there as a site-wide default. Real
 * per-route previews would need prerendering or SSR.
 */

const SITE_NAME = "Uma Musume Carat Calculator"

/**
 * Finds a <head> tag or creates it, so we reuse the tags already present in
 * index.html rather than appending a duplicate on first navigation. Two
 * <meta name="description"> tags is not a crash, but which one wins is not
 * something worth leaving to the parser.
 */
function upsertTag<T extends HTMLElement>(
	selector: string,
	create: () => T,
): T {
	const existing = document.head.querySelector<T>(selector)
	if (existing) return existing

	const created = create()
	document.head.appendChild(created)
	return created
}

export function useDocumentMeta(
	/** Page name alone; the site name is appended. Pass null for the homepage,
	 *  which should title as the site itself rather than "Home | ...". */
	title: string | null,
	description: string,
	/** Keeps a page out of search results. For pages that are plumbing rather
	 *  than content — see robots.txt, which blocks the same two paths. */
	noindex = false,
): void {
	const { pathname } = useLocation()

	useEffect(() => {
		document.title = title ? `${title} | ${SITE_NAME}` : SITE_NAME

		upsertTag<HTMLMetaElement>('meta[name="description"]', () => {
			const tag = document.createElement("meta")
			tag.name = "description"
			return tag
		}).content = description

		// Origin at runtime rather than a hardcoded base, so this keeps working
		// across localhost, the DigitalOcean hostname and the custom domain with
		// no build config. pathname only: query strings and hashes are never the
		// canonical form of a page here.
		upsertTag<HTMLLinkElement>('link[rel="canonical"]', () => {
			const tag = document.createElement("link")
			tag.rel = "canonical"
			return tag
		}).href = `${window.location.origin}${pathname}`

		// Add or remove rather than set/unset: an empty robots tag is not the same
		// as no robots tag, and a stale noindex left behind by a previous route
		// would quietly deindex a real page.
		const robots = document.head.querySelector('meta[name="robots"]')
		if (noindex) {
			if (!robots) {
				const tag = document.createElement("meta")
				tag.name = "robots"
				tag.content = "noindex, nofollow"
				document.head.appendChild(tag)
			}
		} else {
			robots?.remove()
		}
	}, [title, description, noindex, pathname])
}

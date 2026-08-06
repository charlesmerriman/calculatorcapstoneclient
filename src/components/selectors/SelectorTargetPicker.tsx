import { useMemo } from "react"
import Select from "react-select"
import type { SingleValue } from "react-select"
import { compactSelectStyles } from "../../utils/reactSelectStyles"
import { isCardEligible } from "../../utils/selectorTickets"
import type {
	AnniversaryEventProduct,
	BannerTimelineForViewing,
	Uma,
	SupportCard
} from "../../types"

interface TargetOption {
	value: number
	label: string
}

interface SelectorTargetPickerProps {
	product: AnniversaryEventProduct
	timelineData: BannerTimelineForViewing[]
	targetUma: number | null
	targetSupport: number | null
	disabled: boolean
	onChange: (target: { uma: number | null; support: number | null }) => void
}

/**
 * Picks the card a selector will be spent on, filtered to what the selector can
 * legally take.
 *
 * The candidate list is built from the banner timeline the app already holds
 * rather than a dedicated endpoint: every card that has ever been featured
 * appears there, along with the first_jp_date eligibility is judged on. Cards
 * with no JP date are excluded under a real cutoff — the same conservative rule
 * the backend applies, so the picker can never offer something the PATCH would
 * then reject.
 */
export const SelectorTargetPicker = ({
	product,
	timelineData,
	targetUma,
	targetSupport,
	disabled,
	onChange,
}: SelectorTargetPickerProps) => {
	const isUma = product.product_type === "uma_selector"

	const options = useMemo<TargetOption[]>(() => {
		// De-duplicated by id: a card featured on several banners (reruns are
		// common) would otherwise appear once per appearance.
		const seen = new Map<number, string>()
		for (const timeline of timelineData) {
			const cards: (Uma | SupportCard)[] = isUma
				? timeline.banner_umas.flatMap((banner) => banner.umas)
				: timeline.banner_supports.flatMap((banner) => banner.support_cards)
			for (const card of cards) {
				if (seen.has(card.id)) continue
				if (!isCardEligible(card.first_jp_date, product.jp_cutoff_date)) continue
				seen.set(card.id, card.name)
			}
		}
		return [...seen.entries()]
			.map(([value, label]) => ({ value, label }))
			.sort((a, b) => a.label.localeCompare(b.label))
	}, [timelineData, isUma, product.jp_cutoff_date])

	const selectedId = isUma ? targetUma : targetSupport
	const selected = options.find((option) => option.value === selectedId) ?? null

	return (
		<Select<TargetOption>
			styles={compactSelectStyles}
			menuPortalTarget={document.body}
			menuPosition="fixed"
			isClearable
			isDisabled={disabled}
			placeholder={
				options.length === 0
					? "No eligible cards"
					: `Choose ${isUma ? "an uma" : "a support card"}…`
			}
			options={options}
			value={selected}
			aria-label={`Target for ${product.name}`}
			onChange={(option: SingleValue<TargetOption>) =>
				onChange({
					uma: isUma ? (option?.value ?? null) : null,
					support: isUma ? null : (option?.value ?? null),
				})
			}
		/>
	)
}

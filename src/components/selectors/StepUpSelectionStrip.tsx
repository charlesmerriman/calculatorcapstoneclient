import { useState } from "react"
import { ChevronRight, Star } from "lucide-react"
import { StepUpSelectionPicker } from "./StepUpSelectionPicker"
import {
	SELECTION_SLOTS,
	findGuaranteedCardArt,
	replaceSelectionsFor,
	selectionsForStepUp,
} from "../../utils/stepUpSelection"
import type {
	BannerStepUp,
	BannerSupport,
	BannerUma,
	UserStepUpSelection,
} from "../../types"

interface StepUpSelectionStripProps {
	/** This campaign's step-ups, already filtered by the caller. */
	stepUps: BannerStepUp[]
	/** Every selection the account holds; rows filter to their own banner. */
	selections: UserStepUpSelection[]
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	disabled: boolean
	onChange: (next: UserStepUpSelection[]) => void
}

/**
 * The campaign card's step-up band: one row per Select Step-Up the campaign
 * sells, each opening the ten-slot picker.
 *
 * It lives on the campaign card because a BannerStepUp already carries an
 * anniversary_event FK — its step-ups belong next to its packs and its selector
 * tickets, which is also where the source sheet keeps them.
 *
 * Renders nothing when a campaign sells no step-ups, so the vast majority of
 * campaign cards are untouched by it.
 */
export const StepUpSelectionStrip = ({
	stepUps,
	selections,
	umaBannerData,
	supportBannerData,
	disabled,
	onChange,
}: StepUpSelectionStripProps) => {
	const [openStepUpId, setOpenStepUpId] = useState<number | null>(null)

	if (stepUps.length === 0) return null

	const openStepUp = stepUps.find((stepUp) => stepUp.id === openStepUpId) ?? null

	return (
		<div className="border-t border-gray-700 px-4 py-3">
			<h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-brand">
				<Star className="h-4 w-4 shrink-0" />
				★3/SSR Select Step-Up Banners
			</h4>
			<ul className="divide-y divide-gray-700/80">
				{stepUps.map((stepUp) => {
					const mine = selectionsForStepUp(selections, stepUp.id)
					const guaranteed = findGuaranteedCardArt(
						mine,
						umaBannerData,
						supportBannerData
					)
					const isUma = stepUp.card_type === "uma"

					return (
						<li key={stepUp.id}>
							<button
								type="button"
								disabled={disabled}
								aria-haspopup="dialog"
								className="flex w-full min-w-0 items-center gap-3 py-2 text-left transition hover:bg-gray-700/30 disabled:cursor-not-allowed disabled:opacity-60"
								onClick={() => setOpenStepUpId(stepUp.id)}
							>
								{/* Guaranteed pick → campaign art → typographic chip. The
								    same order the planner row uses, so a step-up looks the
								    same in both places. */}
								<span
									className={`flex ${
										isUma ? "h-12 w-12" : "h-12 w-9"
									} shrink-0 items-center justify-center overflow-hidden rounded border border-gray-600 bg-gray-900/50`}
								>
									{guaranteed ? (
										<img
											src={guaranteed.image}
											alt=""
											loading="lazy"
											decoding="async"
											className="h-full w-full object-contain"
										/>
									) : stepUp.image ? (
										<img
											src={stepUp.image}
											alt=""
											loading="lazy"
											decoding="async"
											className="h-full w-full object-contain"
										/>
									) : (
										<span className="text-xs font-bold text-purple-300">
											{isUma ? "★3" : "SSR"}
										</span>
									)}
								</span>

								<span className="min-w-0 flex-1">
									<span className="block truncate text-sm text-gray-200">
										{stepUp.name}
									</span>
									<span className="block truncate text-xs text-gray-500">
										{guaranteed
											? `Guaranteed: ${guaranteed.name}`
											: mine.length > 0
												? "No step 5 pick chosen"
												: "No cards chosen yet"}
									</span>
								</span>

								<span className="shrink-0 text-xs font-semibold tabular-nums text-gray-400">
									{mine.length}/{SELECTION_SLOTS}
								</span>
								<ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
							</button>
						</li>
					)
				})}
			</ul>

			{openStepUp && (
				<StepUpSelectionPicker
					stepUp={openStepUp}
					selections={selectionsForStepUp(selections, openStepUp.id)}
					umaBannerData={umaBannerData}
					supportBannerData={supportBannerData}
					onClose={() => setOpenStepUpId(null)}
					onChange={(next) =>
						onChange(replaceSelectionsFor(selections, openStepUp.id, next))
					}
				/>
			)}
		</div>
	)
}

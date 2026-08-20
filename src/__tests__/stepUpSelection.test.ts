import { describe, it, expect } from 'vitest'
import {
  SELECTION_SLOTS,
  clearSlot,
  findGuaranteedCardArt,
  replaceSelectionsFor,
  selectedCardIds,
  selectionsForStepUp,
  setTarget,
  slotView,
  targetOf,
  toggleCard,
} from '../utils/stepUpSelection'
import type {
  BannerStepUp,
  BannerSupport,
  BannerUma,
  UserStepUpSelection,
} from '../types'

/**
 * Slot bookkeeping for a Select Step-Up's ten picks.
 *
 * NOTHING HERE MAY MOVE A NUMBER. The step-up target rate is 3% / 10 and holds
 * whichever ten are chosen — utils/stepUpLadder.ts owns everything that does
 * affect the projection, and its tests must keep passing unedited.
 */

const timeline = {
  id: 1,
  name: 'Window',
  banner_category: 'standard' as const,
  start_date: '2099-01-01T22:00:00Z',
  end_date: '2099-02-01T21:59:59Z',
  is_predicted: false,
  jp_start_date: null,
  jp_end_date: null,
  global_start_date: '2099-01-01T22:00:00Z',
  global_end_date: '2099-02-01T21:59:59Z',
  schedule_offset_days: 0,
  applied_offset_days: 0,
  image: '',
}

const umaStepUp: BannerStepUp = {
  id: 7,
  banner_timeline: timeline,
  anniversary_event: 14,
  name: '5th Anniversary ★3 Select Step-Up',
  card_type: 'uma',
  banner_count: 2,
  max_steps: 10,
  jp_cutoff_date: '2026-01-30',
  image: null,
  admin_comments: '',
  order: 0,
}

const supportStepUp: BannerStepUp = { ...umaStepUp, id: 8, card_type: 'support' }

/** Fill n slots of `stepUp` with card ids 101, 102, … */
const fill = (stepUp: BannerStepUp, count: number): UserStepUpSelection[] => {
  let selections: UserStepUpSelection[] = []
  for (let i = 0; i < count; i += 1) {
    selections = toggleCard(selections, stepUp, 101 + i)
  }
  return selections
}

describe('toggleCard', () => {
  it('places the first pick in slot 1', () => {
    const next = toggleCard([], umaStepUp, 101)
    expect(next).toEqual([
      { banner_step_up: 7, uma: 101, support: null, slot: 1, is_target: false },
    ])
  })

  it('writes the card to the FK its pool implies', () => {
    expect(toggleCard([], umaStepUp, 101)[0]).toMatchObject({ uma: 101, support: null })
    expect(toggleCard([], supportStepUp, 101)[0]).toMatchObject({ uma: null, support: 101 })
  })

  it('removes a card that is already chosen', () => {
    const chosen = toggleCard([], umaStepUp, 101)
    expect(toggleCard(chosen, umaStepUp, 101)).toEqual([])
  })

  it('reuses the lowest free slot rather than drifting rightwards', () => {
    // Clear slot 2 of three picks, then pick again — the new card lands back in
    // 2, not in 4. Otherwise a few edits push the grid off the end.
    const three = fill(umaStepUp, 3)
    const gapped = clearSlot(three, 2)
    const refilled = toggleCard(gapped, umaStepUp, 999)
    expect(refilled.find((s) => s.uma === 999)?.slot).toBe(2)
  })

  it('keeps the result in slot order', () => {
    const gapped = clearSlot(fill(umaStepUp, 3), 2)
    const refilled = toggleCard(gapped, umaStepUp, 999)
    expect(refilled.map((s) => s.slot)).toEqual([1, 2, 3])
  })

  it('refuses an eleventh card rather than evicting an earlier pick', () => {
    const full = fill(umaStepUp, SELECTION_SLOTS)
    expect(full).toHaveLength(SELECTION_SLOTS)
    expect(toggleCard(full, umaStepUp, 999)).toBe(full)
  })

  it('still allows deselecting when full', () => {
    const full = fill(umaStepUp, SELECTION_SLOTS)
    expect(toggleCard(full, umaStepUp, 101)).toHaveLength(SELECTION_SLOTS - 1)
  })

  it('leaves the plan without a step 5 pick when that card is removed', () => {
    // Deliberately does NOT promote a neighbour: which copy you'd guarantee is
    // a real decision, and guessing it makes a plan quietly mean something else.
    const withTarget = setTarget(fill(umaStepUp, 3), 2)
    const after = toggleCard(withTarget, umaStepUp, 102)
    expect(targetOf(after)).toBeNull()
    expect(after).toHaveLength(2)
  })
})

describe('setTarget', () => {
  it('marks exactly one slot', () => {
    const next = setTarget(fill(umaStepUp, 3), 2)
    expect(next.filter((s) => s.is_target).map((s) => s.slot)).toEqual([2])
  })

  it('moves the marker rather than adding a second', () => {
    // The server enforces one target per banner with a partial unique index;
    // sending two would 400 the whole PATCH.
    const next = setTarget(setTarget(fill(umaStepUp, 3), 1), 3)
    expect(next.filter((s) => s.is_target).map((s) => s.slot)).toEqual([3])
  })

  it('clears the marker when the same slot is named again', () => {
    const once = setTarget(fill(umaStepUp, 3), 2)
    expect(targetOf(setTarget(once, 2))).toBeNull()
  })
})

describe('clearSlot', () => {
  it('empties one slot and leaves the others where they are', () => {
    const next = clearSlot(fill(umaStepUp, 3), 2)
    expect(next.map((s) => s.slot)).toEqual([1, 3])
  })
})

describe('slotView', () => {
  it('always returns ten entries', () => {
    expect(slotView([])).toHaveLength(SELECTION_SLOTS)
    expect(slotView(fill(umaStepUp, 3))).toHaveLength(SELECTION_SLOTS)
  })

  it('turns sparse rows into a dense grid with nulls in the gaps', () => {
    // An empty slot is an ABSENT row on the server — this is where that becomes
    // the grid the UI draws.
    const view = slotView(clearSlot(fill(umaStepUp, 3), 2))
    expect(view[0]).not.toBeNull()
    expect(view[1]).toBeNull()
    expect(view[2]).not.toBeNull()
    expect(view[9]).toBeNull()
  })

  it('ignores a slot number outside the grid instead of growing it', () => {
    const rogue: UserStepUpSelection[] = [
      { banner_step_up: 7, uma: 1, support: null, slot: 99, is_target: false },
    ]
    expect(slotView(rogue).every((entry) => entry === null)).toBe(true)
    expect(slotView(rogue)).toHaveLength(SELECTION_SLOTS)
  })
})

describe('selectionsForStepUp / replaceSelectionsFor', () => {
  const mixed: UserStepUpSelection[] = [
    ...fill(umaStepUp, 2),
    ...fill(supportStepUp, 3),
  ]

  it('filters to one banner', () => {
    expect(selectionsForStepUp(mixed, 7)).toHaveLength(2)
    expect(selectionsForStepUp(mixed, 8)).toHaveLength(3)
  })

  it('returns slot order even when the input is not sorted', () => {
    const shuffled = [...selectionsForStepUp(mixed, 8)].reverse()
    expect(selectionsForStepUp(shuffled, 8).map((s) => s.slot)).toEqual([1, 2, 3])
  })

  it('swaps one banner\'s selections without touching the others', () => {
    const next = replaceSelectionsFor(mixed, 7, [])
    expect(selectionsForStepUp(next, 7)).toEqual([])
    expect(selectionsForStepUp(next, 8)).toHaveLength(3)
  })
})

describe('selectedCardIds', () => {
  it('collects ids from whichever pool the rows came from', () => {
    const mixed = [...fill(umaStepUp, 2), ...fill(supportStepUp, 1)]
    expect(selectedCardIds(mixed)).toEqual(new Set([101, 102]))
  })

  it('skips a row whose card has gone', () => {
    const orphan: UserStepUpSelection[] = [
      { banner_step_up: 7, uma: null, support: null, slot: 1, is_target: false },
    ]
    expect(selectedCardIds(orphan).size).toBe(0)
  })
})

describe('findGuaranteedCardArt', () => {
  const uma = {
    id: 101,
    name: 'Kiseki',
    image: 'kiseki.png',
    admin_comments: '',
    recommendation: '',
    first_jp_date: '2025-06-01',
  }
  const support = {
    id: 201,
    name: 'Matikanefukukitaru',
    image: 'fuku.png',
    admin_comments: '',
    recommendation: '',
    first_jp_date: '2025-06-01',
  }
  const umaBanners: BannerUma[] = [
    { id: 1, banner_timeline: timeline, name: 'B', admin_comments: '', umas: [uma], free_pulls: 0 },
  ]
  const supportBanners: BannerSupport[] = [
    {
      id: 2, banner_timeline: timeline, name: 'B', admin_comments: '',
      support_cards: [support], free_pulls: 0,
    },
  ]

  it('returns null when no step 5 pick has been named', () => {
    expect(findGuaranteedCardArt(fill(umaStepUp, 3), umaBanners, supportBanners)).toBeNull()
  })

  it('resolves the marked uma', () => {
    const selections = setTarget(toggleCard([], umaStepUp, 101), 1)
    expect(findGuaranteedCardArt(selections, umaBanners, supportBanners)).toEqual({
      name: 'Kiseki',
      image: 'kiseki.png',
    })
  })

  it('resolves the marked support card', () => {
    const selections = setTarget(toggleCard([], supportStepUp, 201), 1)
    expect(findGuaranteedCardArt(selections, umaBanners, supportBanners)).toEqual({
      name: 'Matikanefukukitaru',
      image: 'fuku.png',
    })
  })

  it('resolves a pick regardless of the campaign cutoff', () => {
    // Deliberately unfiltered, unlike useEligibleCardCatalogue: a pick that a
    // later cutoff correction put out of reach should keep rendering in the
    // planner rather than blink out. The picker is where staleness is flagged.
    const late = { ...uma, id: 102, name: 'Too New', first_jp_date: '2099-01-01' }
    const banners: BannerUma[] = [{ ...umaBanners[0], umas: [late] }]
    const selections = setTarget(toggleCard([], umaStepUp, 102), 1)
    expect(findGuaranteedCardArt(selections, banners, supportBanners)?.name).toBe('Too New')
  })

  it('returns null when the marked card is no longer in the catalogue', () => {
    const selections = setTarget(toggleCard([], umaStepUp, 999), 1)
    expect(findGuaranteedCardArt(selections, umaBanners, supportBanners)).toBeNull()
  })
})

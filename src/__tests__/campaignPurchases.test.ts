import { describe, expect, it } from 'vitest'
import { purchaseCarats } from '../utils/campaignPurchases'
import type { AnniversaryEventProduct } from '../types'

const pack = (
  paid_carat_amount: number,
  webstore_multiplier: number
): AnniversaryEventProduct => ({
  id: 1,
  product_type: 'carat_pack',
  name: 'Test Pack',
  usd_cost: 70,
  paid_carat_amount,
  webstore_multiplier,
  max_quantity: 3,
  jp_cutoff_date: null,
  jp_cutoff_date_override: null,
  order: 1,
})

describe('purchaseCarats', () => {
  it('is all paid carats with the webstore bonus off', () => {
    expect(purchaseCarats(pack(7500, 1.1), 2, false)).toEqual({
      paidCarats: 15_000,
      freeCarats: 0,
    })
  })

  it('keeps the pack paid and gives the bonus as free carats', () => {
    // The 11,000 pack at its 1.2x rate: 11,000 paid, 2,200 free — NOT 13,200
    // paid, which would let a step-up spend the bonus.
    expect(purchaseCarats(pack(11_000, 1.2), 1, true)).toEqual({
      paidCarats: 11_000,
      freeCarats: 2_200,
    })
  })

  it('re-sums to the rounded total when the bonus lands on a fraction', () => {
    // 1,500 x 1.15 = 1,725 exactly; 1,501 x 1.15 = 1,726.15 -> 1,726, so the
    // free half absorbs the rounding rather than a carat going missing.
    const odd = purchaseCarats(pack(1501, 1.15), 1, true)
    expect(odd.paidCarats + odd.freeCarats).toBe(1726)
    expect(odd.paidCarats).toBe(1501)
  })

  it('never mints negative free carats from a bad multiplier', () => {
    expect(purchaseCarats(pack(7500, 0.5), 1, true)).toEqual({
      paidCarats: 7500,
      freeCarats: 0,
    })
  })

  it('contributes nothing at zero quantity', () => {
    expect(purchaseCarats(pack(7500, 1.1), 0, true)).toEqual({
      paidCarats: 0,
      freeCarats: 0,
    })
  })
})

import { describe, it, expect } from 'vitest'
import {
  SELECTORS_CAMPAIGN_PARAM,
  parseCampaignFocus,
  selectorsCampaignHref,
} from '../utils/selectorsFocus'

/**
 * The URL contract between a timeline campaign strip's "Plan purchases" link
 * and the Selectors page. Both ends read this module, so the round trip is the
 * thing worth pinning: a link the page cannot parse silently degrades to
 * landing at the top, which is the bug this contract exists to fix.
 */
describe('selectors campaign deep link', () => {
  it('round-trips an id through the href it builds', () => {
    const href = selectorsCampaignHref(42)
    const value = new URL(href, 'https://example.test').searchParams.get(
      SELECTORS_CAMPAIGN_PARAM
    )

    expect(parseCampaignFocus(value)).toBe(42)
  })

  it('points at the Selectors route', () => {
    expect(selectorsCampaignHref(7)).toBe('/app/selectors?campaign=7')
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['non-numeric', 'anniversary'],
    // parseInt would read this as 12 and send the reader to a campaign the URL
    // never named.
    ['numeric prefix', '12abc'],
    ['fractional', '1.5'],
    ['negative', '-3'],
    // Number('') is 0 and 0 is an integer, so the positivity check is doing
    // real work rather than tidying up. Django keys start at 1.
    ['zero', '0'],
  ])('degrades %s to no target rather than a wrong one', (_label, raw) => {
    expect(parseCampaignFocus(raw)).toBeNull()
  })
})

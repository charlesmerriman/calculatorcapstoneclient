import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ExtraCardsBadge } from '../components/carat-calculator/ExtraCardsBadge'

/**
 * The planner's rows cap featured thumbnails at two. That cap is right for a
 * table row — what was wrong is that a Golden Week revival featuring eleven umas
 * rendered two of them with nothing to say the rest existed.
 *
 * So the badge must appear only when something is actually hidden: every
 * ordinary one- or two-card banner has to render exactly as it did before.
 */
describe('ExtraCardsBadge', () => {
  it('renders nothing when every card is already shown', () => {
    const { container } = render(<ExtraCardsBadge hidden={0} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for a banner with fewer cards than the cap', () => {
    // images.length - 2 goes negative for a one-card banner, which is by far
    // the most common row in the planner.
    const { container } = render(<ExtraCardsBadge hidden={-1} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('states how many are hidden', () => {
    render(<ExtraCardsBadge hidden={9} />)
    expect(screen.getByText(/\+9/)).toBeInTheDocument()
  })

  it('describes the hidden cards for screen readers, which have no alt text to read', () => {
    render(<ExtraCardsBadge hidden={9} />)
    expect(
      screen.getByTitle('9 more featured cards on this banner'),
    ).toBeInTheDocument()
  })

  it('says "card" rather than "cards" when exactly one is hidden', () => {
    render(<ExtraCardsBadge hidden={1} />)
    expect(
      screen.getByTitle('1 more featured card on this banner'),
    ).toBeInTheDocument()
  })
})

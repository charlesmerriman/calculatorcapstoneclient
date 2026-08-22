import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { AnniversaryEventStrip } from '../components/timeline/AnniversaryEventStrip'
import type { AttachedAnniversaryEvent } from '../types'

const EVENT: AttachedAnniversaryEvent = {
  id: 12,
  name: '3rd Anniversary',
  event_type: 'anniversary',
  accent_label: '',
  image: null,
  part_number: 2,
}

describe('AnniversaryEventStrip', () => {
  it('sends "Plan purchases" to its own campaign, not the bare page', () => {
    render(
      <MemoryRouter>
        <AnniversaryEventStrip event={EVENT} />
      </MemoryRouter>
    )

    // `id` here is the AnniversaryEvent's own key — the backend serializes
    // `event.id` onto the attached summary — so it matches the id the Selectors
    // page keys its campaign cards on.
    expect(screen.getByRole('link', { name: /plan purchases/i })).toHaveAttribute(
      'href',
      '/app/selectors?campaign=12'
    )
  })
})

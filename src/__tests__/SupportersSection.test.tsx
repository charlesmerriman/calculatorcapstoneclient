import { render, screen, waitFor } from '@testing-library/react'
import { vi, beforeEach } from 'vitest'
import { SupportersSection } from '../components/home/SupportersSection'
import { supportersFetch } from '../services/supportersFetchCalls'
import type { SupportersResponse } from '../types'

vi.mock('../services/supportersFetchCalls', () => ({
  supportersFetch: vi.fn(),
}))

const mockedFetch = vi.mocked(supportersFetch)

function jsonResponse(data: SupportersResponse): Response {
  return { ok: true, json: async () => data } as unknown as Response
}

function body(overrides: Partial<SupportersResponse> = {}): SupportersResponse {
  return { tiers: [], supporters: [], anonymous_count: 0, ...overrides }
}

beforeEach(() => {
  mockedFetch.mockReset()
})

describe('SupportersSection', () => {
  it('renders nothing when there is nobody to thank', async () => {
    mockedFetch.mockResolvedValue(jsonResponse(body()))
    const { container } = render(<SupportersSection />)
    await waitFor(() => expect(mockedFetch).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the request fails, rather than an error state', async () => {
    mockedFetch.mockResolvedValue({ ok: false } as unknown as Response)
    const { container } = render(<SupportersSection />)
    await waitFor(() => expect(mockedFetch).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the request rejects outright', async () => {
    mockedFetch.mockRejectedValue(new Error('offline'))
    const { container } = render(<SupportersSection />)
    await waitFor(() => expect(mockedFetch).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('lists supporter names', async () => {
    mockedFetch.mockResolvedValue(jsonResponse(body({
      supporters: [
        { id: 1, display_name: 'Rhondal', tier_name: 'Junior Class', tier_order: 10 },
        { id: 2, display_name: 'Chrom', tier_name: 'Classic Class', tier_order: 20 },
      ],
    })))
    render(<SupportersSection />)
    expect(await screen.findByText('Rhondal')).toBeInTheDocument()
    expect(screen.getByText('Chrom')).toBeInTheDocument()
  })

  it('labels each group with its tier name', async () => {
    mockedFetch.mockResolvedValue(jsonResponse(body({
      supporters: [
        { id: 1, display_name: 'Egg', tier_name: 'Senior Class', tier_order: 10 },
        { id: 2, display_name: 'Chrom', tier_name: 'Classic Class', tier_order: 20 },
      ],
    })))
    render(<SupportersSection />)
    expect(await screen.findByRole('heading', { name: 'Senior Class' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Classic Class' })).toBeInTheDocument()
  })

  it('emphasises by tier POSITION, so renaming or renumbering tiers changes nothing', async () => {
    // Orders 500/900 — nowhere near a 0-based index. The top tier present must
    // still take the first emphasis style.
    mockedFetch.mockResolvedValue(jsonResponse(body({
      supporters: [
        { id: 1, display_name: 'Top', tier_name: 'Whatever They Called It', tier_order: 500 },
        { id: 2, display_name: 'Second', tier_name: 'Also Renamed', tier_order: 900 },
      ],
    })))
    render(<SupportersSection />)

    expect((await screen.findByText('Top')).closest('li')).toHaveClass('font-semibold', 'text-brand')
    expect(screen.getByText('Second').closest('li')).toHaveClass('font-medium', 'text-gray-100')
  })

  it('falls back to the base style for a supporter with no tier, and gives them no heading', async () => {
    mockedFetch.mockResolvedValue(jsonResponse(body({
      supporters: [{ id: 1, display_name: 'Untiered', tier_name: null, tier_order: null }],
    })))
    render(<SupportersSection />)
    expect((await screen.findByText('Untiered')).closest('li')).toHaveClass('text-gray-200')
    // "Other" would rank people the admin never ranked, so the group is unlabelled.
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument()
  })

  it('renders untiered supporters last, whichever order the API returned them in', async () => {
    // SQLite sorts a NULL tier to the front and PostgreSQL sorts it to the back,
    // so the response order is not something the component can trust.
    mockedFetch.mockResolvedValue(jsonResponse(body({
      supporters: [
        { id: 1, display_name: 'NoTier', tier_name: null, tier_order: null },
        { id: 2, display_name: 'Tiered', tier_name: 'Junior Class', tier_order: 10 },
      ],
    })))
    render(<SupportersSection />)
    await screen.findByText('Tiered')
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Tiered', 'NoTier'])
  })

  it('falls back to the base style once tiers run past the emphasis styles', async () => {
    mockedFetch.mockResolvedValue(jsonResponse(body({
      supporters: [
        { id: 1, display_name: 'First', tier_name: 'A', tier_order: 10 },
        { id: 2, display_name: 'Second', tier_name: 'B', tier_order: 20 },
        { id: 3, display_name: 'Third', tier_name: 'C', tier_order: 30 },
      ],
    })))
    render(<SupportersSection />)
    expect((await screen.findByText('Third')).closest('li')).toHaveClass('text-gray-200')
  })

  it('appends the anonymous count alongside named supporters', async () => {
    mockedFetch.mockResolvedValue(jsonResponse(body({
      supporters: [{ id: 1, display_name: 'Rhondal', tier_name: 'Junior Class', tier_order: 10 }],
      anonymous_count: 16,
    })))
    render(<SupportersSection />)
    expect(await screen.findByText(/… and 16 anonymous supporters\./)).toBeInTheDocument()
  })

  it('still thanks anonymous supporters when nobody has consented to be named', async () => {
    mockedFetch.mockResolvedValue(jsonResponse(body({ anonymous_count: 16 })))
    render(<SupportersSection />)
    expect(await screen.findByText(/Thank you to 16 anonymous supporters\./)).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('uses the singular for one anonymous supporter', async () => {
    mockedFetch.mockResolvedValue(jsonResponse(body({ anonymous_count: 1 })))
    render(<SupportersSection />)
    expect(await screen.findByText(/Thank you to 1 anonymous supporter\./)).toBeInTheDocument()
  })
})

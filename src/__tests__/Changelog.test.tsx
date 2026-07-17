import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, beforeEach } from 'vitest'
import { Changelog } from '../components/info/Changelog'
import { changelogFetch } from '../services/changelogFetchCalls'
import type { ChangelogEntry } from '../types'

// Mock the fetch service so the page renders against controlled data.
vi.mock('../services/changelogFetchCalls', () => ({
  changelogFetch: vi.fn(),
}))

// Navbar/Footer pull in theme + calculator contexts we don't need here; stub
// them so the test focuses on the changelog content itself.
vi.mock('../components/navbar/Navbar', () => ({ Navbar: () => null }))
vi.mock('../components/footer/Footer', () => ({ Footer: () => null }))

const mockedFetch = vi.mocked(changelogFetch)

/** Build a Response-like object matching what the component consumes (.ok, .json()). */
function jsonResponse(data: ChangelogEntry[]): Response {
  return { ok: true, json: async () => data } as unknown as Response
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Changelog />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockedFetch.mockReset()
})

describe('Changelog page', () => {
  it('renders entries with their version badge and categorized changes', async () => {
    const entries: ChangelogEntry[] = [
      {
        id: 1,
        title: 'Changelog added',
        version: 'v1.1',
        date: '2026-07-16',
        changes: [
          { id: 1, category: 'added', text: 'A changelog page.', order: 0 },
          { id: 2, category: 'fixed', text: 'A weekend income bug.', order: 1 },
        ],
      },
    ]
    mockedFetch.mockResolvedValue(jsonResponse(entries))

    renderPage()

    expect(await screen.findByText('Changelog added')).toBeInTheDocument()
    expect(screen.getByText('v1.1')).toBeInTheDocument()
    expect(screen.getByText('A changelog page.')).toBeInTheDocument()
    // Category chip labels.
    expect(screen.getByText('Added')).toBeInTheDocument()
    expect(screen.getByText('Fixed')).toBeInTheDocument()
  })

  it('shows an empty-state message when there are no entries', async () => {
    mockedFetch.mockResolvedValue(jsonResponse([]))

    renderPage()

    expect(await screen.findByText(/No updates yet/i)).toBeInTheDocument()
  })

  it('shows an error state when the fetch fails', async () => {
    mockedFetch.mockResolvedValue({ ok: false, status: 500 } as unknown as Response)

    renderPage()

    await waitFor(() =>
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument(),
    )
  })
})

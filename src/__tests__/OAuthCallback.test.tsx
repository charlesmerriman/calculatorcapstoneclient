import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OAuthCallback } from '../components/auth/OAuthCallback'
import { completeSocialLogin } from '../services/socialAuth'
import { ApiError } from '../services/userServices'

vi.mock('../services/socialAuth', () => ({
  completeSocialLogin: vi.fn(),
}))

// Footer pulls in contexts this test doesn't need.
vi.mock('../components/footer/Footer', () => ({ Footer: () => null }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockedComplete = vi.mocked(completeSocialLogin)

function renderAt(query: string) {
  return render(
    <MemoryRouter initialEntries={[`/auth/callback${query}`]}>
      <OAuthCallback />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockedComplete.mockReset()
  mockNavigate.mockReset()
  sessionStorage.clear()
  sessionStorage.setItem(
    'oauthState.v1',
    JSON.stringify({ provider: 'google', state: 'ST8', createdAt: Date.now() }),
  )
})

describe('OAuthCallback', () => {
  it('exchanges the code and navigates to the app', async () => {
    mockedComplete.mockResolvedValue(undefined)

    renderAt('?code=CODE&state=ST8')

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/app', { replace: true })
    })
    expect(mockedComplete).toHaveBeenCalledWith('google', 'CODE', 'ST8')
  })

  it('shows a spinner while the exchange is in flight', () => {
    mockedComplete.mockReturnValue(new Promise(() => {}))

    renderAt('?code=CODE&state=ST8')

    expect(screen.getByText(/signing you in/i)).toBeInTheDocument()
  })

  /**
   * The authorization code is single-use, so a second exchange would fail and
   * show an error to a user who actually signed in fine. StrictMode double-
   * mounts every component in dev, which is exactly this scenario.
   */
  it('only exchanges once when mounted twice (StrictMode guard)', async () => {
    mockedComplete.mockResolvedValue(undefined)

    const { rerender } = renderAt('?code=CODE&state=ST8')
    rerender(
      <MemoryRouter initialEntries={['/auth/callback?code=CODE&state=ST8']}>
        <OAuthCallback />
      </MemoryRouter>,
    )

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled())
    expect(mockedComplete).toHaveBeenCalledTimes(1)
  })

  it('reports a cancelled sign-in without alarming language', async () => {
    renderAt('?error=access_denied')

    expect(await screen.findByRole('alert')).toHaveTextContent(/cancelled/i)
    expect(mockedComplete).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('reports other provider errors', async () => {
    renderAt('?error=server_error')

    expect(await screen.findByRole('alert')).toHaveTextContent(/problem/i)
    expect(mockedComplete).not.toHaveBeenCalled()
  })

  it('reports an incomplete callback URL', async () => {
    renderAt('?code=CODE')

    expect(await screen.findByRole('alert')).toHaveTextContent(/incomplete/i)
    expect(mockedComplete).not.toHaveBeenCalled()
  })

  it('surfaces the service error message on a failed exchange', async () => {
    mockedComplete.mockRejectedValue(new ApiError('This sign-in link is no longer valid. Please try again.'))

    renderAt('?code=CODE&state=ST8')

    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer valid/i)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('offers a way back and a guest escape hatch on failure', async () => {
    mockedComplete.mockRejectedValue(new Error('boom'))

    renderAt('?code=CODE&state=ST8')

    await screen.findByRole('alert')
    expect(screen.getByRole('link', { name: /back to sign in/i })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: /without an account/i })).toHaveAttribute('href', '/app')
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BetaGate } from '../components/auth/BetaGate'

// The Footer pulls in routing links that are irrelevant to the gate's behaviour.
vi.mock('../components/footer/Footer', () => ({ Footer: () => null }))

const STORAGE_KEY = 'betaAccess.v1'
const ENV_KEY = 'VITE_BETA_PASSCODE_HASH'

/** SHA-256 of "abc" — the passcode used throughout these tests. */
const HASH_OF_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

/** The gate is transparent when open, so a sentinel child is the assertion. */
function renderGate() {
  return render(
    <BetaGate>
      <p>calculator</p>
    </BetaGate>
  )
}

const appIsVisible = () => screen.queryByText('calculator') !== null

/** Fill the passcode field and submit the form. */
function submitPasscode(value: string) {
  fireEvent.change(screen.getByLabelText('Passcode'), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
}

beforeEach(() => {
  localStorage.clear()
  vi.stubEnv(ENV_KEY, HASH_OF_ABC)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('BetaGate', () => {
  it('renders children immediately when the gate is switched off', () => {
    // The launch-day path: variable removed, feature inert.
    vi.stubEnv(ENV_KEY, '')
    renderGate()
    expect(appIsVisible()).toBe(true)
    expect(screen.queryByLabelText('Passcode')).toBeNull()
  })

  it('renders children when this browser already holds a valid grant', () => {
    localStorage.setItem(STORAGE_KEY, HASH_OF_ABC)
    renderGate()
    expect(appIsVisible()).toBe(true)
  })

  it('shows the passcode form and hides the app when there is no grant', () => {
    renderGate()
    expect(appIsVisible()).toBe(false)
    expect(screen.getByLabelText('Passcode')).toBeInTheDocument()
  })

  it('re-prompts a browser whose grant is for a rotated passcode', () => {
    localStorage.setItem(STORAGE_KEY, HASH_OF_ABC)
    vi.stubEnv(ENV_KEY, 'a'.repeat(64))
    renderGate()
    expect(appIsVisible()).toBe(false)
  })

  it('rejects a wrong passcode without storing anything', async () => {
    renderGate()
    submitPasscode('nope')

    expect(await screen.findByRole('alert')).toHaveTextContent(/passcode isn't right/i)
    expect(appIsVisible()).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('unlocks on the right passcode and remembers it', async () => {
    renderGate()
    submitPasscode('abc')

    await waitFor(() => {
      expect(appIsVisible()).toBe(true)
    })
    expect(localStorage.getItem(STORAGE_KEY)).toBe(HASH_OF_ABC)
  })
})

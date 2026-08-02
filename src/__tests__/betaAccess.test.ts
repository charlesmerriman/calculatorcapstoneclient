import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearGrant,
  hasValidGrant,
  isGateEnabled,
  normalizePasscode,
  sha256Hex,
  verifyPasscode,
} from '../services/betaAccess'

const STORAGE_KEY = 'betaAccess.v1'
const ENV_KEY = 'VITE_BETA_PASSCODE_HASH'

/** Published SHA-256 test vector: the digest of the string "abc". */
const HASH_OF_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

beforeEach(() => {
  // jsdom persists storage across tests in a file, and frontend/.env sets a real
  // hash that would otherwise leak in — pin both so every test starts identical.
  localStorage.clear()
  vi.stubEnv(ENV_KEY, HASH_OF_ABC)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('normalizePasscode', () => {
  it('strips surrounding whitespace and lowercases', () => {
    // The realistic input: pasted out of Discord with a trailing newline.
    expect(normalizePasscode('  UmaBeta2026 \n')).toBe('umabeta2026')
  })
})

describe('sha256Hex', () => {
  it('matches the published digest for "abc"', async () => {
    await expect(sha256Hex('abc')).resolves.toBe(HASH_OF_ABC)
  })
})

describe('isGateEnabled', () => {
  it('is on when a hash is configured', () => {
    expect(isGateEnabled()).toBe(true)
  })

  it('is off when the variable is empty — the launch-day switch', () => {
    vi.stubEnv(ENV_KEY, '')
    expect(isGateEnabled()).toBe(false)
  })

  it('is off when the variable holds only whitespace', () => {
    vi.stubEnv(ENV_KEY, '   ')
    expect(isGateEnabled()).toBe(false)
  })
})

describe('hasValidGrant', () => {
  it('is false with nothing stored', () => {
    expect(hasValidGrant()).toBe(false)
  })

  it('is true when the stored hash matches the configured one', () => {
    localStorage.setItem(STORAGE_KEY, HASH_OF_ABC)
    expect(hasValidGrant()).toBe(true)
  })

  it('is false for a hand-forged value', () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    expect(hasValidGrant()).toBe(false)
  })

  it('is false once the passcode is rotated, locking existing browsers out', () => {
    localStorage.setItem(STORAGE_KEY, HASH_OF_ABC)
    vi.stubEnv(ENV_KEY, 'a'.repeat(64))
    expect(hasValidGrant()).toBe(false)
  })

  it('is false when the gate is switched off', () => {
    localStorage.setItem(STORAGE_KEY, HASH_OF_ABC)
    vi.stubEnv(ENV_KEY, '')
    expect(hasValidGrant()).toBe(false)
  })
})

describe('verifyPasscode', () => {
  it('accepts the right passcode and remembers it', async () => {
    await expect(verifyPasscode('abc')).resolves.toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(HASH_OF_ABC)
  })

  it('accepts it regardless of case and padding', async () => {
    await expect(verifyPasscode('  ABC\n')).resolves.toBe(true)
  })

  it('rejects the wrong passcode and stores nothing', async () => {
    await expect(verifyPasscode('abd')).resolves.toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('tolerates a configured hash pasted with stray case and whitespace', async () => {
    // The likely real-world .env / DigitalOcean dashboard mishap.
    vi.stubEnv(ENV_KEY, ` ${HASH_OF_ABC.toUpperCase()}\n`)
    await expect(verifyPasscode('abc')).resolves.toBe(true)
  })
})

describe('clearGrant', () => {
  it('re-locks the browser', () => {
    localStorage.setItem(STORAGE_KEY, HASH_OF_ABC)
    clearGrant()
    expect(hasValidGrant()).toBe(false)
  })
})

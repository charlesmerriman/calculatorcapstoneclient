/**
 * Where this build points its API, and whether that is somewhere remote.
 *
 * Two things need this answer and must never disagree about it: the dev-only
 * LIVE DATA badge (components/ApiSourceBadge.tsx) and the traffic beacon
 * (services/visitBeacon.ts), which suppresses itself under `npm run dev:live`
 * so local work cannot inflate production's visit counts. Duplicating the test
 * would eventually let one drift and quietly start writing to prod.
 */

// Read once at module scope: Vite statically replaces import.meta.env.* at build
// time, so these are constants, not lookups.
export const API_URL: string = import.meta.env.VITE_API_URL ?? ""

// Anything that isn't a loopback host is a remote backend — in practice the
// live DigitalOcean app via `npm run dev:live`. Deliberately a positive test for
// "local" rather than a match against the production hostname, so pointing at
// any other deployment (a staging app, a tunnel) still counts as remote.
export const isRemoteBackend = !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(API_URL)

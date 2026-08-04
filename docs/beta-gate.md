# Closed-beta passcode gate

`components/auth/BetaGate.tsx` wraps the `/app/*` route element, gating the planner
behind a single shared passcode handed out to Patreon supporters. The logic lives in
`services/betaAccess.ts`.

Every route other than `/app/*` stays reachable without a passcode.

---

## This is a soft gate — a deliberate accepted trade-off

The Django API is untouched and fully public. `curl <api>/calculator-data` still returns
everything.

It keeps casual visitors out. **It is not a security boundary.** Don't extend it as if it
were one — if the beta ever needs real enforcement, that belongs on the API, not here.

---

## How it works

- **`VITE_BETA_PASSCODE_HASH`** holds the SHA-256 hex of the passcode, so the plaintext
  never ships in the bundle and the value is safe to commit. Verified: `grep` the built
  `dist/` for the passcode and you get nothing.
- **`localStorage["betaAccess.v1"]` stores that same hash.** The boot check is therefore a
  synchronous string comparison — no async work before first paint, so neither the app nor
  the form flashes. It also means **rotating the passcode instantly re-locks every
  browser**.
- Hashing (async `crypto.subtle`) runs **only on submit**, never on load. That asymmetry
  is what keeps the whole thing simple.
- Passcodes are compared after `trim().toLowerCase()`. `scripts/hash-passcode.mjs` applies
  the identical normalization — **always generate hashes with it** rather than by hand, or
  you can produce a passcode that is silently never accepted.

---

## Setting or rotating the passcode

```bash
cd frontend
npm run hash-passcode -- 'YourPasscode'
```

Put the printed value in `frontend/.env.local` (gitignored via `*.local`) for local dev.

For production, set it as a **`BUILD_TIME` environment variable on the DigitalOcean
frontend (static site) component**, matching how `VITE_API_URL` is already configured in
`backend/.do/app.yaml`.

### `frontend/.env` holds a blank value and must stay blank

Vite loads `.env` for production builds too, so a hash committed there becomes the
fallback whenever the DigitalOcean variable is missing or misspelled.

Because this repo is public, that fallback would be a gate running on a passcode anyone
can read — a site that *looks* protected while accepting a published code, which is
strictly worse than no gate at all.

Blank means a misconfiguration fails open and visibly instead.

### A `BUILD_TIME` scope is required

A static site has no running server — Vite bakes `VITE_*` values into the JS during
`npm run build` — so a variable scoped `RUN_TIME` is **silently ignored** and the site
deploys ungated, with no error anywhere.

Always confirm against the live bundle after deploying.

---

## Switching it off at launch

Delete `VITE_BETA_PASSCODE_HASH` from the DigitalOcean dashboard and redeploy.
`isGateEnabled()` goes false and `BetaGate` renders its children untouched — no code
change needed.

**It fails open on purpose**: a misconfigured deploy locking out every tester is worse
than the site being briefly public.

To remove the code as well, delete:

- `services/betaAccess.ts`
- `components/auth/BetaGate.tsx`
- `scripts/hash-passcode.mjs`
- the two test files
- the `<BetaGate>` wrapper and its import in `App.tsx`

Stale `betaAccess.v1` entries in users' localStorage are inert either way.

---

## Local development note

`/app` is behind the gate locally whenever `.env.local` sets `VITE_BETA_PASSCODE_HASH`,
so headless screenshots of `/app` capture the passcode card, not the planner. To reach the
real planner, start a second dev server with the gate off:

```bash
VITE_BETA_PASSCODE_HASH= npx vite --port 5199 --strictPort
```

Django's `CORS_ALLOWED_ORIGINS` only whitelists `:5173`, so `/calculator-data` will fail
on that port and you get the "Failed to load data" screen. Fix it browser-side rather than
changing the server config — see the headless-screenshot notes for the Chrome flags.

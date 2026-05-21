# Lucy Realtime — Secure Production Deployment (Next.js)

This repo includes a minimal Next.js setup and a secure API proxy to avoid exposing your Decart API key in the browser.

Quick summary:
- Local dev: `npm run dev` (Next.js)
- Build: `npm run build`
- Start (production): `npm start`
- Secure proxy: `pages/api/proxy-decart.js` (reads `DECART_API_KEY`)

Local testing

1. Install deps:

```bash
npm install
```

2. Run dev server:

```bash
npm run dev
```

3. Open http://localhost:3000 and allow camera access. Use the Capture button to send a frame to the server API route.

Security notes (do NOT deploy with a client-side API key)

- Keep your `DECART_API_KEY` out of the frontend. Set it in Vercel or in `./.env.local` for local development (never commit `.env.local`).
- The frontend calls `/api/proxy-decart` which forwards the request server-side with the secret key.
- Add auth, rate limits, and usage quotas before public launch.

Deploying to GitHub + Vercel

1. Create a GitHub repo named `lucy-realtime`.
2. Push your code (see the user's original steps: `git init`, `git add .`, `git commit -m "Initial Lucy realtime app"`, `git remote add origin ...`, `git push -u origin main`).
3. In Vercel: import the project from GitHub, set the following environment variables in the Vercel dashboard:

   - `DECART_API_KEY` = your secret key
   - `DECART_API_URL` (optional)

4. Deploy. Vercel will build and host the Next.js app and the serverless API route.

Recommended production upgrades

- Add authentication (Clerk or Auth.js), usage tracking, and billing (Stripe).
- Enforce rate limits and per-user quotas server-side.
- Move long-running or heavy workloads to a separate backend or queued worker with GPU access.

Files added

- `pages/index.js` — minimal webcam UI and capture
- `pages/api/proxy-decart.js` — server-side proxy to Decart
- `.gitignore`, `vercel.json` — deployment helpers

Environment

Local: create a `.env.local` with:

```
DECART_API_KEY=sk_...
DECART_API_URL=https://api.decart.ai/v1/transform
# Optional protection
REQUIRE_APP_TOKEN=true
APP_TOKEN=some-secret-token
NEXT_PUBLIC_APP_TOKEN=some-secret-token
# Rate limits
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX=60
```

Important notes:

- `DECART_API_KEY` must stay server-side and never be committed.
- `REQUIRE_APP_TOKEN=true` enables a simple token gate on the API route.
- `NEXT_PUBLIC_APP_TOKEN` is only for development convenience and is visible in client builds; do not treat it as a secret in production.
- `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` control the per-IP window and request cap.
- In-memory rate limiting is not durable across serverless instances; use Redis or another shared store for production.

Never commit secrets.

If you want, I can also:
- Add an authentication layer to the API route
- Add rate-limiting middleware
- Convert the UI to Tailwind

Tell me which next step you'd like me to do.
# lucy-realtime

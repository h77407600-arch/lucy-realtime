# Lucy Realtime

This project is now set up as a hardened production baseline for a private Decart-powered realtime webcam app on Next.js and Vercel.

What is built in:

- Server-side Decart proxy and short-lived realtime client tokens so the API key never reaches the browser
- Signed HttpOnly session cookie auth backed by `APP_ACCESS_PASSWORD`
- Redis-backed rate limiting in production via Upstash
- Realtime Lucy `lucy-2.1` browser streaming with 16:9 camera constraints
- Request validation, payload size limits, and upstream timeout handling for the fallback proxy
- Health endpoint for deployment checks: `/api/health`

## Production Requirements

Set these environment variables in Vercel Project Settings or with `vercel env add`:

```bash
DECART_API_KEY=...
DECART_API_URL=https://api.decart.ai/v1/transform
DECART_REALTIME_MODEL=lucy-2.1
DECART_TOKEN_EXPIRES_SECONDS=300
DECART_MAX_SESSION_SECONDS=600
DECART_ALLOWED_ORIGINS=https://your-domain.example
APP_ACCESS_PASSWORD=use-a-long-random-access-code
SESSION_SECRET=use-a-32-byte-or-longer-random-secret
SESSION_TTL_HOURS=8
DECART_TIMEOUT_MS=15000
MAX_IMAGE_BYTES=3145728
MAX_PROMPT_LENGTH=500
PROXY_RATE_LIMIT_MAX=20
PROXY_RATE_LIMIT_WINDOW=1 m
TOKEN_RATE_LIMIT_MAX=10
TOKEN_RATE_LIMIT_WINDOW=1 m
LOGIN_RATE_LIMIT_MAX=5
LOGIN_RATE_LIMIT_WINDOW=10 m
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

Notes:

- `APP_ACCESS_PASSWORD` is a shared access gate for this deployment. It is appropriate for a restricted/private app. For a public multi-user product, replace this with full user auth.
- `SESSION_SECRET` should be at least 32 characters and kept server-side only.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are required for production rate limiting.
- `DECART_ALLOWED_ORIGINS` should include your production origin so browser realtime tokens are origin-scoped.
- Do not put secrets in `NEXT_PUBLIC_*` variables.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example`.

3. Start the app:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000), sign in with `APP_ACCESS_PASSWORD`, allow camera access, then start realtime.

Local development can fall back to in-memory rate limiting if Upstash is not configured. Production will reject requests until Upstash Redis is configured.

## Verification

Run the test and build gates before deploying:

```bash
npm test
npm run build
npm audit --omit=dev
```

Check deployment health:

```bash
curl https://your-deployment-url/api/health
npm run verify:health -- https://your-deployment-url
```

Expected behavior:

- `200 OK` when auth, Decart, and rate-limit requirements are configured
- `503` when the deployment is missing required production configuration

## Deploying on Vercel

Vercel detects Next.js automatically, so the repo uses a minimal `vercel.json` with only function duration overrides.

For a step-by-step deployment checklist, see [DEPLOYMENT.md](/C:/Users/Sfafa/lucy-realtime/DEPLOYMENT.md).

Recommended setup:

1. Link the project or import it in Vercel.
2. Add the required environment variables in Project Settings.
3. Pull the environment locally when needed:

```bash
vercel env pull .env.local --yes
```

4. Deploy after `npm test` and `npm run build` pass.

Before a real production deploy, you can verify the required secret/env shape locally:

```bash
npm run verify:production-config
```

For a single release gate that mirrors CI:

```bash
npm run verify:release
```

## Security Model

- Browser requests never receive the Decart secret; they receive short-lived Decart client tokens after session auth.
- Authenticated access is enforced in the API route, not only in frontend code.
- Session cookies are `HttpOnly`, `SameSite=Strict`, and `Secure` in production.
- Requests are validated before proxying upstream.
- Upstream calls are time-boxed to avoid hanging serverless invocations.
- CI now enforces test, build, and production dependency audit checks on pushes and pull requests.

## API Routes

- `/api/auth/login` — exchange `APP_ACCESS_PASSWORD` for a signed session cookie
- `/api/auth/logout` — clear the current session
- `/api/auth/session` — check whether the current session is authenticated
- `/api/decart-token` — create a short-lived, model-scoped Decart realtime client token
- `/api/proxy-decart` — authenticated image transform proxy
- `/api/health` — deployment readiness endpoint

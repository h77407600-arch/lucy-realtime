# Deployment Runbook

Use this checklist when you are ready to push Lucy Realtime to production on Vercel.

## 1. Preflight

- Confirm `.env.example` still contains placeholders, not real secrets.
- Make sure your working tree only contains changes you intend to deploy.
- If you changed dependencies, run:

```bash
npm install
```

## 2. Local Release Gate

Run the full local release gate:

```bash
npm run verify:release
```

Expected result:

- Tests pass
- Production build passes
- `npm audit --omit=dev` reports `found 0 vulnerabilities`

## 3. Production Secret Check

Before deploying, validate that the production env shape is complete.

If you already have the production values locally:

```bash
npm run verify:production-config
```

Required variables:

- `DECART_API_KEY`
- `APP_ACCESS_PASSWORD`
- `SESSION_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Important:

- `APP_ACCESS_PASSWORD` should be long and random.
- `SESSION_SECRET` should be at least 32 characters.
- Do not place any of these in `NEXT_PUBLIC_*`.

## 4. Vercel Project Setup

In Vercel Project Settings, add:

```bash
DECART_API_KEY=...
DECART_API_URL=https://api.decart.ai/v1/transform
DECART_REALTIME_MODEL=lucy-2.1
DECART_TOKEN_EXPIRES_SECONDS=300
DECART_MAX_SESSION_SECONDS=600
DECART_ALLOWED_ORIGINS=https://your-domain.example
APP_ACCESS_PASSWORD=...
SESSION_SECRET=...
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

Recommended environment scoping:

- Production: all of the values above
- Preview: same structure, but use non-production Decart and Redis resources if available
- Development: optional for `vercel env pull` workflows

## 5. Deploy

Deploy from Vercel after the repo is connected and the env vars are in place.

If you want local parity first:

```bash
vercel env pull .env.local --yes
```

Then deploy from the Vercel dashboard or your normal Git-based flow.

## 6. Post-Deploy Smoke Check

Run the health check against the live deployment:

```bash
npm run verify:health -- https://your-deployment-url
```

Expected result:

- `/api/health` returns `200`
- `ok` is `true`
- `checks.decartConfigured` is `true`
- `checks.authConfigured` is `true`
- `checks.redisConfigured` is `true`

If `redisConfigured` is `false` in production, the proxy route should be treated as not ready.

## 7. Manual Browser Smoke Test

After health passes:

1. Open the deployed site.
2. Confirm the sign-in screen appears first.
3. Enter `APP_ACCESS_PASSWORD`.
4. Confirm camera permission is requested only after sign-in.
5. Start the realtime stream.
6. Confirm the Lucy Output video receives a remote stream instead of a browser/network error.

## 8. Failure Triage

If the deploy is unhealthy:

- `401` from proxy:
  The session cookie was not created or the access code is wrong.

- `500` with auth/config errors:
  One or more required Vercel env vars are missing or malformed.

- `503` from `/api/health`:
  The deployment is missing required production readiness conditions.

- `429` from login or proxy:
  Rate limiting is active; review the request pattern or configured limits.

- `504` from proxy:
  The upstream Decart call timed out; check `DECART_API_URL`, upstream health, and timeout settings.

- Realtime starts then fails:
  Check `DECART_REALTIME_MODEL`, `DECART_ALLOWED_ORIGINS`, token limits, and whether the Decart account supports realtime for `lucy-2.1`.

## 9. Recommended Final Gate

Before calling the deployment done, confirm all of these are true:

- `npm run verify:release` passed on the shipped code
- Vercel env vars were added for production
- `npm run verify:health -- <deployment-url>` passed
- Manual sign-in and realtime stream flow worked once in the browser

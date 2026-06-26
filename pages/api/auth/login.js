import { getSessionCookieHeader, safeEqualSecret } from "../../../lib/auth.mjs";
import { applyRateLimitHeaders, enforceRateLimit } from "../../../lib/rate-limit.mjs";
import { getHealthState } from "../../../lib/server-config.mjs";

function sendJson(res, status, body) {
  res.status(status).json(body);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  const health = getHealthState();
  if (!health.checks.authConfigured) {
    return sendJson(res, 500, { error: "Authentication is not configured on the server." });
  }

  const rateLimit = await enforceRateLimit(req, "login");
  applyRateLimitHeaders(res, rateLimit);
  if (!rateLimit.ok) {
    return sendJson(res, rateLimit.status || 429, { error: rateLimit.error || "Too many login attempts. Please try again later." });
  }

  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!password || password.length > 256) {
    return sendJson(res, 400, { error: "A valid access code is required." });
  }

  if (!safeEqualSecret(password, process.env.APP_ACCESS_PASSWORD)) {
    return sendJson(res, 401, { error: "Invalid access code." });
  }

  res.setHeader("Set-Cookie", getSessionCookieHeader());
  return sendJson(res, 200, { authenticated: true });
}

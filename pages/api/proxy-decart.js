import { hasValidSession } from "../../lib/auth.mjs";
import { applyRateLimitHeaders, enforceRateLimit } from "../../lib/rate-limit.mjs";
import { validateProxyPayload } from "../../lib/request-validation.mjs";
import { getHealthState, getServerConfig } from "../../lib/server-config.mjs";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "8mb",
    },
  },
};

async function readJsonResponse(response) {
  const raw = await response.text();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return { detail: raw };
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const health = getHealthState();
  if (!health.checks.decartConfigured) {
    return res.status(500).json({ error: "Missing DECART_API_KEY on the server." });
  }

  if (!health.checks.authConfigured) {
    return res.status(500).json({ error: "Authentication is not configured on the server." });
  }

  if (!hasValidSession(req)) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const rateLimit = await enforceRateLimit(req, "proxy");
  applyRateLimitHeaders(res, rateLimit);
  if (!rateLimit.ok) {
    return res.status(rateLimit.status || 429).json({ error: rateLimit.error || "Rate limit exceeded." });
  }

  const serverConfig = getServerConfig();
  const validation = validateProxyPayload(req.body, {
    maxImageBytes: serverConfig.maxImageBytes,
    maxPromptLength: serverConfig.maxPromptLength,
  });

  if (!validation.ok) {
    return res.status(validation.status).json({ error: validation.error });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), serverConfig.decartTimeoutMs);

  try {
    const upstreamResponse = await fetch(serverConfig.decartUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverConfig.decartApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validation.value),
      signal: controller.signal,
    });

    const payload = await readJsonResponse(upstreamResponse);

    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json({
        error: "Decart request failed.",
        upstream: payload,
      });
    }

    return res.status(200).json(payload);
  } catch (error) {
    const isAbort = error?.name === "AbortError";
    return res.status(isAbort ? 504 : 500).json({
      error: isAbort ? "Decart request timed out." : "Unexpected proxy failure.",
      detail: error?.message || "Unknown error",
    });
  } finally {
    clearTimeout(timeout);
  }
}

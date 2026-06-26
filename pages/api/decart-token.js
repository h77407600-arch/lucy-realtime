import { createDecartClient, isRealtimeModel } from "@decartai/sdk";

import { hasValidSession } from "../../lib/auth.mjs";
import { applyRateLimitHeaders, enforceRateLimit } from "../../lib/rate-limit.mjs";
import { getHealthState, getServerConfig } from "../../lib/server-config.mjs";

function getRequestOrigin(req) {
  const origin = req.headers.origin;
  if (typeof origin === "string" && /^https?:\/\//i.test(origin)) {
    return origin;
  }

  return "";
}

function getAllowedOrigins(req, configuredOrigins) {
  const requestOrigin = getRequestOrigin(req);
  const origins = new Set(configuredOrigins);

  if (requestOrigin) {
    origins.add(requestOrigin);
  }

  return Array.from(origins);
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

  const rateLimit = await enforceRateLimit(req, "token");
  applyRateLimitHeaders(res, rateLimit);
  if (!rateLimit.ok) {
    return res.status(rateLimit.status || 429).json({ error: rateLimit.error || "Rate limit exceeded." });
  }

  const serverConfig = getServerConfig();
  if (!isRealtimeModel(serverConfig.decartRealtimeModel)) {
    return res.status(500).json({ error: `Invalid realtime model: ${serverConfig.decartRealtimeModel}` });
  }

  const allowedOrigins = getAllowedOrigins(req, serverConfig.decartAllowedOrigins);
  const tokenOptions = {
    expiresIn: serverConfig.decartTokenExpiresSeconds,
    allowedModels: [serverConfig.decartRealtimeModel],
    constraints: {
      realtime: {
        maxSessionDuration: serverConfig.decartMaxSessionSeconds,
      },
    },
    metadata: {
      app: "lucy-realtime",
      feature: "browser-realtime",
    },
  };

  if (allowedOrigins.length > 0) {
    tokenOptions.allowedOrigins = allowedOrigins;
  }

  try {
    const client = createDecartClient({ apiKey: serverConfig.decartApiKey });
    const token = await client.tokens.create(tokenOptions);

    return res.status(200).json({
      apiKey: token.apiKey,
      expiresAt: token.expiresAt,
      model: serverConfig.decartRealtimeModel,
      permissions: token.permissions || null,
      constraints: token.constraints || null,
    });
  } catch (error) {
    return res.status(502).json({
      error: "Unable to create Decart client token.",
      detail: error?.message || "Unknown error",
    });
  }
}

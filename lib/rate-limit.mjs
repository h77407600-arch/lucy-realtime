import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { getLoginRateLimitConfig, getProxyRateLimitConfig, getTokenRateLimitConfig, hasRedisConfig, isProduction, parseWindowToMs } from "./server-config.mjs";

const localStores = new Map();
const limiters = new Map();

let redisClient = null;

function getClientIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}

function getRedisClient() {
  if (!hasRedisConfig()) return null;
  if (!redisClient) {
    redisClient = Redis.fromEnv();
  }

  return redisClient;
}

function getScopeConfig(scope) {
  if (scope === "login") return getLoginRateLimitConfig();
  if (scope === "token") return getTokenRateLimitConfig();
  return getProxyRateLimitConfig();
}

function getLimiter(scope) {
  if (limiters.has(scope)) return limiters.get(scope);

  const redis = getRedisClient();
  if (!redis) return null;

  const config = getScopeConfig(scope);
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.limit, config.window),
    analytics: true,
    prefix: `lucy-realtime:${scope}`,
  });

  limiters.set(scope, limiter);
  return limiter;
}

function getLocalStore(scope) {
  if (!localStores.has(scope)) {
    localStores.set(scope, new Map());
  }

  return localStores.get(scope);
}

function limitInMemory(scope, identifier) {
  const config = getScopeConfig(scope);
  const windowMs = parseWindowToMs(config.window);
  const now = Date.now();
  const store = getLocalStore(scope);
  const history = (store.get(identifier) || []).filter((timestamp) => now - timestamp < windowMs);

  history.push(now);
  store.set(identifier, history);

  const success = history.length <= config.limit;
  const reset = history[0] ? history[0] + windowMs : now + windowMs;

  return {
    ok: success,
    limit: config.limit,
    remaining: Math.max(0, config.limit - history.length),
    reset,
    source: "memory",
  };
}

export function applyRateLimitHeaders(res, result) {
  if (!result) return;

  res.setHeader("X-RateLimit-Limit", String(result.limit));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, result.remaining)));
  res.setHeader("X-RateLimit-Reset", String(result.reset));

  if (!result.ok) {
    const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1_000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
  }
}

export async function enforceRateLimit(req, scope) {
  const identifier = `${scope}:${getClientIp(req)}`;

  if (hasRedisConfig()) {
    const limiter = getLimiter(scope);
    const result = await limiter.limit(identifier);

    return {
      ok: result.success,
      limit: result.limit ?? getScopeConfig(scope).limit,
      remaining: result.remaining ?? 0,
      reset: result.reset ?? Date.now(),
      source: "upstash",
    };
  }

  if (isProduction()) {
    return {
      ok: false,
      status: 500,
      error: "Missing Upstash Redis configuration for production rate limiting.",
      limit: 0,
      remaining: 0,
      reset: Date.now(),
      source: "missing-config",
    };
  }

  return limitInMemory(scope, identifier);
}

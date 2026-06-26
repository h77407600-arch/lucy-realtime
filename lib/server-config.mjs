const DEFAULT_PROXY_RATE_LIMIT_WINDOW = "1 m";
const DEFAULT_LOGIN_RATE_LIMIT_WINDOW = "10 m";
const DEFAULT_TOKEN_RATE_LIMIT_WINDOW = "1 m";

function parseIntegerEnv(name, defaultValue, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name];
  if (!raw) return defaultValue;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  if (parsed < min) return min;
  if (parsed > max) return max;

  return parsed;
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function hasRedisConfig() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export function hasStrongAccessPassword() {
  return typeof process.env.APP_ACCESS_PASSWORD === "string" && process.env.APP_ACCESS_PASSWORD.length >= 12;
}

export function hasStrongSessionSecret() {
  return typeof process.env.SESSION_SECRET === "string" && process.env.SESSION_SECRET.length >= 32;
}

export function parseWindowToMs(windowSpec) {
  const normalized = String(windowSpec || "").trim().toLowerCase();
  const match = normalized.match(/^(\d+)\s*([smhd])$/);

  if (!match) {
    throw new Error(`Invalid rate-limit window "${windowSpec}". Use formats like "30 s", "10 m", or "1 h".`);
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2];

  const unitMs = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return amount * unitMs[unit];
}

export function getProxyRateLimitConfig() {
  return {
    limit: parseIntegerEnv("PROXY_RATE_LIMIT_MAX", 20, { min: 1, max: 1_000 }),
    window: process.env.PROXY_RATE_LIMIT_WINDOW || DEFAULT_PROXY_RATE_LIMIT_WINDOW,
  };
}

export function getTokenRateLimitConfig() {
  return {
    limit: parseIntegerEnv("TOKEN_RATE_LIMIT_MAX", 10, { min: 1, max: 1_000 }),
    window: process.env.TOKEN_RATE_LIMIT_WINDOW || DEFAULT_TOKEN_RATE_LIMIT_WINDOW,
  };
}

export function getLoginRateLimitConfig() {
  return {
    limit: parseIntegerEnv("LOGIN_RATE_LIMIT_MAX", 5, { min: 1, max: 100 }),
    window: process.env.LOGIN_RATE_LIMIT_WINDOW || DEFAULT_LOGIN_RATE_LIMIT_WINDOW,
  };
}

function parseCsvEnv(name) {
  const raw = process.env[name];
  if (!raw) return [];

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getServerConfig() {
  return {
    decartApiKey: process.env.DECART_API_KEY || "",
    decartUrl: process.env.DECART_API_URL || "https://api.decart.ai/v1/transform",
    decartTimeoutMs: parseIntegerEnv("DECART_TIMEOUT_MS", 15_000, { min: 1_000, max: 60_000 }),
    maxImageBytes: parseIntegerEnv("MAX_IMAGE_BYTES", 3 * 1024 * 1024, { min: 256_000, max: 10 * 1024 * 1024 }),
    maxPromptLength: parseIntegerEnv("MAX_PROMPT_LENGTH", 500, { min: 32, max: 4_000 }),
    sessionTtlHours: parseIntegerEnv("SESSION_TTL_HOURS", 8, { min: 1, max: 168 }),
    decartRealtimeModel: process.env.DECART_REALTIME_MODEL || "lucy-2.1",
    decartTokenExpiresSeconds: parseIntegerEnv("DECART_TOKEN_EXPIRES_SECONDS", 300, { min: 1, max: 3_600 }),
    decartMaxSessionSeconds: parseIntegerEnv("DECART_MAX_SESSION_SECONDS", 600, { min: 30, max: 3_600 }),
    decartAllowedOrigins: parseCsvEnv("DECART_ALLOWED_ORIGINS"),
  };
}

export function getHealthState() {
  const authConfigured = hasStrongAccessPassword() && hasStrongSessionSecret();
  const decartConfigured = Boolean(process.env.DECART_API_KEY);
  const redisConfigured = hasRedisConfig();
  const ready = decartConfigured && authConfigured && (!isProduction() || redisConfigured);

  return {
    environment: process.env.NODE_ENV || "development",
    ready,
    rateLimiter: redisConfigured ? "upstash" : "memory",
    checks: {
      decartConfigured,
      authConfigured,
      redisConfigured,
    },
  };
}

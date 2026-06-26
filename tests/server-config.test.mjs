import test from "node:test";
import assert from "node:assert/strict";

import { getServerConfig, getTokenRateLimitConfig, parseWindowToMs } from "../lib/server-config.mjs";

test("parseWindowToMs supports compact duration strings", () => {
  assert.equal(parseWindowToMs("1 m"), 60_000);
  assert.equal(parseWindowToMs("2h"), 7_200_000);
});

test("getServerConfig includes realtime token defaults", () => {
  const previousModel = process.env.DECART_REALTIME_MODEL;
  const previousOrigins = process.env.DECART_ALLOWED_ORIGINS;

  delete process.env.DECART_REALTIME_MODEL;
  process.env.DECART_ALLOWED_ORIGINS = "https://example.com, http://localhost:3000";

  const config = getServerConfig();
  assert.equal(config.decartRealtimeModel, "lucy-2.1");
  assert.equal(config.decartTokenExpiresSeconds, 300);
  assert.equal(config.decartMaxSessionSeconds, 600);
  assert.deepEqual(config.decartAllowedOrigins, ["https://example.com", "http://localhost:3000"]);

  if (previousModel === undefined) delete process.env.DECART_REALTIME_MODEL;
  else process.env.DECART_REALTIME_MODEL = previousModel;

  if (previousOrigins === undefined) delete process.env.DECART_ALLOWED_ORIGINS;
  else process.env.DECART_ALLOWED_ORIGINS = previousOrigins;
});

test("getTokenRateLimitConfig has production-safe defaults", () => {
  const previousMax = process.env.TOKEN_RATE_LIMIT_MAX;
  const previousWindow = process.env.TOKEN_RATE_LIMIT_WINDOW;

  delete process.env.TOKEN_RATE_LIMIT_MAX;
  delete process.env.TOKEN_RATE_LIMIT_WINDOW;

  const config = getTokenRateLimitConfig();
  assert.equal(config.limit, 10);
  assert.equal(config.window, "1 m");

  if (previousMax === undefined) delete process.env.TOKEN_RATE_LIMIT_MAX;
  else process.env.TOKEN_RATE_LIMIT_MAX = previousMax;

  if (previousWindow === undefined) delete process.env.TOKEN_RATE_LIMIT_WINDOW;
  else process.env.TOKEN_RATE_LIMIT_WINDOW = previousWindow;
});

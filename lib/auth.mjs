import crypto from "node:crypto";

import { getServerConfig, isProduction } from "./server-config.mjs";

const DEFAULT_COOKIE_NAME = "lucy_rt_session";

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(payload) {
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

function getCookieName() {
  return process.env.SESSION_COOKIE_NAME || DEFAULT_COOKIE_NAME;
}

function getSessionSecrets() {
  return [process.env.SESSION_SECRET, process.env.SESSION_SECRET_PREVIOUS].filter(Boolean);
}

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${value}`];

  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.path) parts.push(`Path=${options.path}`);

  return parts.join("; ");
}

export function parseCookies(cookieHeader = "") {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((accumulator, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) return accumulator;

      const key = part.slice(0, separatorIndex);
      const value = part.slice(separatorIndex + 1);
      accumulator[key] = value;
      return accumulator;
    }, {});
}

export function createSessionToken() {
  const { sessionTtlHours } = getServerConfig();
  const expiresAt = Date.now() + sessionTtlHours * 60 * 60 * 1_000;
  const payload = encodePayload({ exp: expiresAt, iat: Date.now(), v: 1 });
  const secret = getSessionSecrets()[0];
  const signature = sign(payload, secret);

  return `${payload}.${signature}`;
}

export function readSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[getCookieName()];
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  for (const secret of getSessionSecrets()) {
    const expected = sign(payload, secret);
    if (signature.length !== expected.length) continue;

    const matches = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!matches) continue;

    const session = decodePayload(payload);
    if (!session?.exp || session.exp <= Date.now()) return null;
    return session;
  }

  return null;
}

export function getSessionCookieHeader() {
  const { sessionTtlHours } = getServerConfig();
  return serializeCookie(getCookieName(), createSessionToken(), {
    httpOnly: true,
    maxAge: sessionTtlHours * 60 * 60,
    path: "/",
    sameSite: "Strict",
    secure: isProduction(),
  });
}

export function getClearedSessionCookieHeader() {
  return serializeCookie(getCookieName(), "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "Strict",
    secure: isProduction(),
  });
}

export function hasValidSession(req) {
  return Boolean(readSession(req));
}

export function safeEqualSecret(provided, expected) {
  const providedDigest = crypto.createHash("sha256").update(String(provided)).digest();
  const expectedDigest = crypto.createHash("sha256").update(String(expected)).digest();

  return crypto.timingSafeEqual(providedDigest, expectedDigest);
}

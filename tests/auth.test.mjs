import test from "node:test";
import assert from "node:assert/strict";

import { createSessionToken, parseCookies, readSession, safeEqualSecret } from "../lib/auth.mjs";

test("safeEqualSecret matches only identical values", () => {
  assert.equal(safeEqualSecret("correct horse battery staple", "correct horse battery staple"), true);
  assert.equal(safeEqualSecret("correct horse battery staple", "wrong password"), false);
});

test("parseCookies returns a cookie map", () => {
  const cookies = parseCookies("a=1; session=token; theme=dark");
  assert.deepEqual(cookies, { a: "1", session: "token", theme: "dark" });
});

test("readSession accepts a signed non-expired cookie", () => {
  process.env.SESSION_SECRET = "12345678901234567890123456789012";
  const token = createSessionToken();
  const session = readSession({
    headers: {
      cookie: `lucy_rt_session=${token}`,
    },
  });

  assert.ok(session);
  assert.equal(typeof session.exp, "number");
});

test("readSession rejects a tampered cookie", () => {
  process.env.SESSION_SECRET = "12345678901234567890123456789012";
  const token = createSessionToken();
  const tampered = `${token}tampered`;
  const session = readSession({
    headers: {
      cookie: `lucy_rt_session=${tampered}`,
    },
  });

  assert.equal(session, null);
});

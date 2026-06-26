import { getClearedSessionCookieHeader } from "../../../lib/auth.mjs";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  res.setHeader("Set-Cookie", getClearedSessionCookieHeader());
  return res.status(200).json({ authenticated: false });
}

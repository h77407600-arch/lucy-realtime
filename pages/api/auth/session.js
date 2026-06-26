import { hasValidSession } from "../../../lib/auth.mjs";
import { getHealthState } from "../../../lib/server-config.mjs";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const health = getHealthState();
  if (!health.checks.authConfigured) {
    return res.status(503).json({ error: "Authentication is not configured on the server.", authenticated: false });
  }

  return res.status(200).json({ authenticated: hasValidSession(req) });
}

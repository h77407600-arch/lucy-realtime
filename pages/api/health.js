import { getHealthState } from "../../lib/server-config.mjs";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const health = getHealthState();
  return res.status(health.ready ? 200 : 503).json({
    ok: health.ready,
    environment: health.environment,
    rateLimiter: health.rateLimiter,
    checks: health.checks,
  });
}

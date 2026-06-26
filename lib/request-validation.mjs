export function estimateBase64Size(base64Value) {
  const normalized = String(base64Value || "").replace(/\s/g, "");
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

export function validateProxyPayload(body, { maxImageBytes, maxPromptLength }) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Expected a JSON object body." };
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return { ok: false, status: 400, error: "Prompt is required." };
  }

  if (prompt.length > maxPromptLength) {
    return { ok: false, status: 400, error: `Prompt exceeds the ${maxPromptLength}-character limit.` };
  }

  const image = typeof body.image === "string" ? body.image.trim() : "";
  const match = image.match(/^data:(image\/png|image\/jpeg|image\/webp);base64,(.+)$/i);

  if (!match) {
    return { ok: false, status: 400, error: "Image must be a PNG, JPEG, or WebP data URL." };
  }

  const payloadSize = estimateBase64Size(match[2]);
  if (!Number.isFinite(payloadSize) || payloadSize <= 0) {
    return { ok: false, status: 400, error: "Image payload is empty or invalid." };
  }

  if (payloadSize > maxImageBytes) {
    return { ok: false, status: 413, error: `Image exceeds the ${maxImageBytes} byte limit.` };
  }

  return {
    ok: true,
    value: {
      image,
      prompt,
    },
  };
}

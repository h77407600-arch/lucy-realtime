import test from "node:test";
import assert from "node:assert/strict";

import { estimateBase64Size, validateProxyPayload } from "../lib/request-validation.mjs";

test("estimateBase64Size handles padding correctly", () => {
  assert.equal(estimateBase64Size("QQ=="), 1);
  assert.equal(estimateBase64Size("QUJD"), 3);
});

test("validateProxyPayload accepts a small png data url", () => {
  const result = validateProxyPayload(
    {
      image: "data:image/png;base64,QQ==",
      prompt: "apply a studio portrait look",
    },
    {
      maxImageBytes: 8,
      maxPromptLength: 100,
    }
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    image: "data:image/png;base64,QQ==",
    prompt: "apply a studio portrait look",
  });
});

test("validateProxyPayload rejects oversized prompts", () => {
  const result = validateProxyPayload(
    {
      image: "data:image/png;base64,QQ==",
      prompt: "x".repeat(101),
    },
    {
      maxImageBytes: 8,
      maxPromptLength: 100,
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
});

test("validateProxyPayload rejects unsupported mime types", () => {
  const result = validateProxyPayload(
    {
      image: "data:text/plain;base64,QQ==",
      prompt: "hello",
    },
    {
      maxImageBytes: 8,
      maxPromptLength: 100,
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
});
